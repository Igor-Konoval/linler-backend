import { Inject, Logger, forwardRef } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { ACCESS_TOKEN_COOKIE_NAME } from 'src/constants/auth-cookies.constants';
import type { AuthUser } from 'src/types/user.type';
import { WorkspacesService } from 'src/workspaces/workspaces.service';
import { parseCookieValue } from './parse-cookie.util';
import {
  REALTIME_NAMESPACE,
  RealtimeEvent,
  type RealtimeEventName,
  userRoom,
  workspaceRoom,
} from './realtime.constants';
import { RealtimeService } from './realtime.service';
import type {
  PageAwarenessPayload,
  PresenceUser,
  WorkspaceJoinPayload,
} from './realtime.types';
import { getSocketAuth, patchSocketAuth } from './socket-auth.util';

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly socketsByUserAndWorkspace = new Map<string, Set<string>>();
  private readonly presenceUsers = new Map<string, PresenceUser>();
  private readonly awarenessByUser = new Map<string, PageAwarenessPayload>();

  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    @Inject(forwardRef(() => WorkspacesService))
    private readonly workspacesService: WorkspacesService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeService.setServer(server);
  }

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = parseCookieValue(
        socket.handshake.headers.cookie,
        ACCESS_TOKEN_COOKIE_NAME,
      );

      if (!token) {
        socket.disconnect(true);
        return;
      }

      const user = await this.authService.validateAccessToken(token);
      patchSocketAuth(socket, { user });
      this.realtimeService.setServer(socket.nsp);
      await socket.join(userRoom(user.id));
    } catch (error) {
      this.logger.debug(
        `Realtime connection rejected: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    this.clearAwareness(socket);

    const { user, workspaceId } = getSocketAuth(socket);

    if (!user || !workspaceId) {
      return;
    }

    this.removeSocketFromWorkspace(socket, workspaceId, user);
  }

  @SubscribeMessage(RealtimeEvent.WORKSPACE_JOIN)
  async onWorkspaceJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: WorkspaceJoinPayload,
  ): Promise<void> {
    const auth = getSocketAuth(socket);
    const user = auth.user;
    const workspaceId = payload?.workspaceId;

    if (!user || !workspaceId) {
      return;
    }

    try {
      await this.workspacesService.assertActiveMember(workspaceId, user.id);
    } catch {
      return;
    }

    if (auth.workspaceId && auth.workspaceId !== workspaceId) {
      this.clearAwareness(socket);
      this.removeSocketFromWorkspace(socket, auth.workspaceId, user);
      await socket.leave(workspaceRoom(auth.workspaceId));
    }

    patchSocketAuth(socket, { workspaceId });
    await socket.join(workspaceRoom(workspaceId));
    this.addSocketToWorkspace(socket.id, workspaceId, user);
    this.emitWorkspaceSnapshot(socket, workspaceId);
    this.emitToOthers(socket, workspaceId, RealtimeEvent.PRESENCE_JOINED, {
      workspaceId,
      user: this.toPresenceUser(user),
    });
  }

  @SubscribeMessage(RealtimeEvent.WORKSPACE_LEAVE)
  async onWorkspaceLeave(@ConnectedSocket() socket: Socket): Promise<void> {
    const { user, workspaceId } = getSocketAuth(socket);

    if (!user || !workspaceId) {
      return;
    }

    this.clearAwareness(socket);
    this.removeSocketFromWorkspace(socket, workspaceId, user);
    await socket.leave(workspaceRoom(workspaceId));
    patchSocketAuth(socket, { workspaceId: undefined });
  }

  @SubscribeMessage(RealtimeEvent.PAGE_AWARENESS_REQUEST)
  onAwarenessRequest(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { workspaceId?: string },
  ): void {
    const auth = getSocketAuth(socket);
    const workspaceId = auth.workspaceId ?? payload?.workspaceId;

    if (!auth.user || !workspaceId) {
      return;
    }

    this.emitWorkspaceSnapshot(socket, workspaceId);
  }

  @SubscribeMessage(RealtimeEvent.PAGE_AWARENESS)
  async onPageAwareness(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    payload: {
      workspaceId?: string;
      pageId?: string;
      blockId?: string | null;
    },
  ): Promise<void> {
    const auth = getSocketAuth(socket);
    const user = auth.user;
    const pageId = payload?.pageId;
    const workspaceId = auth.workspaceId ?? payload?.workspaceId;

    if (!user || !workspaceId || !pageId) {
      return;
    }

    const presenceKey = this.presenceKey(workspaceId, user.id);
    const wasPresent =
      (this.socketsByUserAndWorkspace.get(presenceKey)?.size ?? 0) > 0;

    if (auth.workspaceId !== workspaceId) {
      try {
        await this.workspacesService.assertActiveMember(workspaceId, user.id);
      } catch {
        return;
      }

      if (auth.workspaceId) {
        this.clearAwareness(socket);
        this.removeSocketFromWorkspace(socket, auth.workspaceId, user);
        await socket.leave(workspaceRoom(auth.workspaceId));
      }

      patchSocketAuth(socket, { workspaceId });
    }

    await socket.join(workspaceRoom(workspaceId));
    this.addSocketToWorkspace(socket.id, workspaceId, user);

    if (!wasPresent) {
      this.emitWorkspaceSnapshot(socket, workspaceId);
      this.emitToOthers(socket, workspaceId, RealtimeEvent.PRESENCE_JOINED, {
        workspaceId,
        user: this.toPresenceUser(user),
      });
    }

    const blockId = payload.blockId ?? null;
    patchSocketAuth(socket, {
      awarenessPageId: blockId ? pageId : undefined,
    });
    this.upsertAwareness(workspaceId, user, pageId, blockId);

    this.emitToOthers(socket, workspaceId, RealtimeEvent.PAGE_AWARENESS, {
      workspaceId,
      pageId,
      blockId,
      user: this.toPresenceUser(user),
    });
  }

  @SubscribeMessage(RealtimeEvent.TASK_BOARD_CHANGED)
  async onTaskBoardChanged(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    payload: {
      workspaceId?: string;
      pageId?: string;
      boardId?: string;
      board?: unknown;
    },
  ): Promise<void> {
    const auth = getSocketAuth(socket);
    const user = auth.user;
    const pageId = payload?.pageId;
    const boardId = payload?.boardId;
    const board = payload?.board;
    const workspaceId = auth.workspaceId ?? payload?.workspaceId;

    if (!user || !workspaceId || !pageId || !boardId || !board) {
      return;
    }

    if (auth.workspaceId !== workspaceId) {
      try {
        await this.workspacesService.assertActiveMember(workspaceId, user.id);
      } catch {
        return;
      }
    }

    this.emitToOthers(socket, workspaceId, RealtimeEvent.TASK_BOARD_CHANGED, {
      workspaceId,
      pageId,
      boardId,
      board,
      actorUserId: user.id,
    });
  }

  private emitWorkspaceSnapshot(socket: Socket, workspaceId: string): void {
    socket.emit(RealtimeEvent.PRESENCE_SYNC, {
      workspaceId,
      users: this.listPresence(workspaceId),
    });
    socket.emit(RealtimeEvent.PAGE_AWARENESS_SYNC, {
      workspaceId,
      entries: this.listAwareness(workspaceId),
    });
  }

  private upsertAwareness(
    workspaceId: string,
    user: AuthUser,
    pageId: string,
    blockId: string | null,
  ): void {
    const key = this.presenceKey(workspaceId, user.id);

    if (!blockId) {
      this.awarenessByUser.delete(key);
      return;
    }

    this.awarenessByUser.set(key, {
      workspaceId,
      pageId,
      blockId,
      user: this.toPresenceUser(user),
    });
  }

  private clearAwareness(socket: Socket): void {
    const { user, workspaceId, awarenessPageId } = getSocketAuth(socket);

    if (!user || !workspaceId || !awarenessPageId) {
      return;
    }

    patchSocketAuth(socket, { awarenessPageId: undefined });
    this.awarenessByUser.delete(this.presenceKey(workspaceId, user.id));
    this.emitToOthers(socket, workspaceId, RealtimeEvent.PAGE_AWARENESS, {
      workspaceId,
      pageId: awarenessPageId,
      blockId: null,
      user: this.toPresenceUser(user),
    });
  }

  private addSocketToWorkspace(
    socketId: string,
    workspaceId: string,
    user: AuthUser,
  ): void {
    const key = this.presenceKey(workspaceId, user.id);
    const sockets = this.socketsByUserAndWorkspace.get(key) ?? new Set();
    sockets.add(socketId);
    this.socketsByUserAndWorkspace.set(key, sockets);
    this.presenceUsers.set(key, this.toPresenceUser(user));
  }

  private removeSocketFromWorkspace(
    socket: Socket,
    workspaceId: string,
    user: AuthUser,
  ): void {
    const key = this.presenceKey(workspaceId, user.id);
    const sockets = this.socketsByUserAndWorkspace.get(key);

    if (!sockets) {
      return;
    }

    sockets.delete(socket.id);

    if (sockets.size > 0) {
      return;
    }

    this.socketsByUserAndWorkspace.delete(key);
    this.presenceUsers.delete(key);
    this.awarenessByUser.delete(key);

    this.emitToOthers(socket, workspaceId, RealtimeEvent.PRESENCE_LEFT, {
      workspaceId,
      userId: user.id,
      lastSeenAt: new Date().toISOString(),
    });
  }

  private emitToOthers(
    socket: Socket,
    workspaceId: string,
    event: RealtimeEventName,
    payload: unknown,
  ): void {
    socket.nsp
      .to(workspaceRoom(workspaceId))
      .except(socket.id)
      .emit(event, payload);
  }

  private listPresence(workspaceId: string): PresenceUser[] {
    const prefix = `${workspaceId}:`;
    const users: PresenceUser[] = [];

    for (const [key, user] of this.presenceUsers) {
      if (key.startsWith(prefix)) {
        users.push(user);
      }
    }

    return users;
  }

  private listAwareness(workspaceId: string): PageAwarenessPayload[] {
    const prefix = `${workspaceId}:`;
    const entries: PageAwarenessPayload[] = [];

    for (const [key, entry] of this.awarenessByUser) {
      if (key.startsWith(prefix) && entry.blockId) {
        entries.push(entry);
      }
    }

    return entries;
  }

  private presenceKey(workspaceId: string, userId: string): string {
    return `${workspaceId}:${userId}`;
  }

  private toPresenceUser(user: AuthUser): PresenceUser {
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
    };
  }
}
