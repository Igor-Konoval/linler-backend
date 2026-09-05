import type { AuthUser } from 'src/types/user.type';
import {
  EntityChangeAction,
  PageChangeAction,
  ProjectMemberChangeAction,
  WorkspaceInvitationChangeAction,
  WorkspaceMemberChangeAction,
} from './realtime.constants';

export type PresenceUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export type PresenceSyncPayload = {
  workspaceId: string;
  users: PresenceUser[];
};

export type PresenceJoinedPayload = {
  workspaceId: string;
  user: PresenceUser;
};

export type PresenceLeftPayload = {
  workspaceId: string;
  userId: string;
  lastSeenAt: string;
};

export type WorkspaceJoinPayload = {
  workspaceId: string;
};

export type SocketAuthData = {
  user?: AuthUser;
  workspaceId?: string;
  awarenessPageId?: string;
};

export type WorkspaceChangedPayload = {
  action: EntityChangeAction;
  workspaceId: string;
  actorUserId: string;
};

export type WorkspaceMemberChangedPayload = {
  action: WorkspaceMemberChangeAction;
  workspaceId: string;
  actorUserId: string;
  targetUserId: string;
};

export type WorkspaceInvitationChangedPayload = {
  action: WorkspaceInvitationChangeAction;
  workspaceId: string;
  actorUserId: string;
};

export type ProjectChangedPayload = {
  action: EntityChangeAction;
  workspaceId: string;
  projectId: string;
  actorUserId: string;
};

export type ProjectMemberChangedPayload = {
  action: ProjectMemberChangeAction;
  workspaceId: string;
  projectId: string;
  actorUserId: string;
  targetUserId: string;
};

export type PageChangedPayload = {
  action: PageChangeAction;
  workspaceId: string;
  projectId: string;
  pageId: string;
  actorUserId: string;
  actor?: PresenceUser;
  updatedAt?: string;
};

export type PageAwarenessPayload = {
  workspaceId: string;
  pageId: string;
  blockId: string | null;
  user: PresenceUser;
};

export type PageAwarenessSyncPayload = {
  workspaceId: string;
  entries: PageAwarenessPayload[];
};

export type TaskBoardChangedPayload = {
  workspaceId: string;
  pageId: string;
  boardId: string;
  board: unknown;
  actorUserId: string;
};
