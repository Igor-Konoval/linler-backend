import { Injectable } from '@nestjs/common';
import type { Namespace, Server } from 'socket.io';
import { userRoom, workspaceRoom } from './realtime.constants';

type RealtimeEmitter = Pick<Server, 'to'>;

@Injectable()
export class RealtimeService {
  private server: RealtimeEmitter | null = null;

  setServer(server: Server | Namespace): void {
    this.server = server;
  }

  emitToWorkspace(workspaceId: string, event: string, payload: unknown): void {
    this.server?.to(workspaceRoom(workspaceId)).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    for (const userId of userIds) {
      this.emitToUser(userId, event, payload);
    }
  }

  emitToWorkspaceAndUsers(
    workspaceId: string,
    userIds: string[],
    event: string,
    payload: unknown,
  ): void {
    this.emitToWorkspace(workspaceId, event, payload);
    this.emitToUsers(userIds, event, payload);
  }
}
