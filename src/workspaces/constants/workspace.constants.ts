import {
  WorkspaceInvitationStatus,
  WorkspaceRole,
} from '../enums/workspace.enums';

export const INVITABLE_ROLES = [
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
  WorkspaceRole.VIEWER,
] as const;

export const MANAGER_ROLES = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN];

export const MY_INBOX_STATUSES: WorkspaceInvitationStatus[] = [
  WorkspaceInvitationStatus.PENDING,
  WorkspaceInvitationStatus.ACCEPTED,
  WorkspaceInvitationStatus.DECLINED,
] as const;

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
