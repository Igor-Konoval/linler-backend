import { NotificationType } from './enums/notification.enums';

export type NotificationPayload = {
  actorUserId: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  workspaceId: string;
  workspaceName: string;
  targetUserId?: string;
  targetUsername?: string;
  projectId?: string;
  pageId?: string;
  pageTitle?: string;
  boardId?: string;
  cardId?: string;
  cardTitle?: string;
  assigneeId?: string;
  assigneeUsername?: string;
  columnId?: string;
  columnName?: string;
  previousColumnName?: string;
};

export type CreateNotificationInput = {
  type: NotificationType;
  workspaceId: string;
  actorUserId: string;
  payload: NotificationPayload;
};
