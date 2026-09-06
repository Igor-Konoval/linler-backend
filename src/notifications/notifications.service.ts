import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { FileService } from 'src/common/services/file.service';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { buildPageMeta } from 'src/common/utils/pagination.util';
import { RealtimeEvent } from 'src/realtime/realtime.constants';
import { RealtimeService } from 'src/realtime/realtime.service';
import { ProjectMemberEntity } from 'src/projects/entities/project-member.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { WorkspaceEntity } from 'src/workspaces/entities/workspace.entity';
import { WorkspaceMemberEntity } from 'src/workspaces/entities/workspace-member.entity';
import { WorkspaceMemberStatus } from 'src/workspaces/enums/workspace.enums';
import { collectTaskCards } from 'src/pages/utils/collect-task-cards.util';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationType } from './enums/notification.enums';
import { MarkNotificationsReadDto } from './dto/mark-notifications-read.dto';
import { NotificationListResponseDto } from './dto/notification-list-response.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { UnreadCountResponseDto } from 'src/workspaces/dto/unread-count-response.dto';
import type { NotificationPayload } from './notification.types';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly membersRepository: Repository<WorkspaceMemberEntity>,
    @InjectRepository(ProjectMemberEntity)
    private readonly projectMembersRepository: Repository<ProjectMemberEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspacesRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly fileService: FileService,
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtimeService: RealtimeService,
  ) {}

  async findMine(
    userId: string,
    pagination: PaginationQueryDto,
  ): Promise<NotificationListResponseDto> {
    const { page, limit } = pagination;

    const [notifications, totalItems, unreadCount] = await Promise.all([
      this.notificationsRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.notificationsRepository.count({ where: { userId } }),
      this.countUnread(userId),
    ]);

    return {
      notifications: notifications.map((notification) =>
        this.toResponse(notification),
      ),
      unreadCount,
      meta: buildPageMeta(totalItems, page, limit),
    };
  }

  async markRead(
    userId: string,
    dto: MarkNotificationsReadDto,
  ): Promise<UnreadCountResponseDto> {
    await this.notificationsRepository.update(
      {
        userId,
        id: In(dto.notificationIds),
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );

    return { unreadCount: await this.countUnread(userId) };
  }

  async markAllRead(userId: string): Promise<UnreadCountResponseDto> {
    await this.notificationsRepository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );

    return { unreadCount: 0 };
  }

  async notifyWorkspaceMemberJoined(params: {
    workspaceId: string;
    actorUserId: string;
  }): Promise<void> {
    const [actor, workspaceName] = await Promise.all([
      this.findUserMap([params.actorUserId]).then((users) =>
        users.get(params.actorUserId),
      ),
      this.getWorkspaceName(params.workspaceId),
    ]);

    if (!actor) {
      return;
    }

    await this.createForAudience({
      workspaceId: params.workspaceId,
      actorUserId: params.actorUserId,
      type: NotificationType.WorkspaceMemberJoined,
      payload: {
        actorUserId: actor.id,
        actorUsername: actor.username,
        actorAvatarUrl: this.fileService.getFullAvatarUrl(actor.avatarUrl),
        workspaceId: params.workspaceId,
        workspaceName,
        targetUserId: actor.id,
        targetUsername: actor.username,
      },
    });
  }

  async notifyTaskBoardChanges(params: {
    workspaceId: string;
    projectId: string;
    pageId: string;
    pageTitle: string;
    actorUserId: string;
    previousContent: unknown;
    nextContent: unknown;
  }): Promise<void> {
    const previousCards = new Map(
      collectTaskCards(params.previousContent).map((card) => [
        card.cardId,
        card,
      ]),
    );
    const nextCards = collectTaskCards(params.nextContent);
    const assigneeIds = nextCards
      .map((card) => card.assigneeId)
      .filter((id): id is string => Boolean(id));
    const [users, workspaceName] = await Promise.all([
      this.findUserMap([params.actorUserId, ...assigneeIds]),
      this.getWorkspaceName(params.workspaceId),
    ]);
    const actorUser = users.get(params.actorUserId);

    if (!actorUser) {
      return;
    }

    const actorPayload = {
      actorUserId: actorUser.id,
      actorUsername: actorUser.username,
      actorAvatarUrl: this.fileService.getFullAvatarUrl(actorUser.avatarUrl),
      workspaceId: params.workspaceId,
      workspaceName,
      projectId: params.projectId,
      pageId: params.pageId,
      pageTitle: params.pageTitle,
    };

    for (const card of nextCards) {
      const previous = previousCards.get(card.cardId);
      const shared = {
        ...actorPayload,
        boardId: card.boardId,
        cardId: card.cardId,
        cardTitle: card.title || 'Untitled',
      };

      if (card.assigneeId && card.assigneeId !== previous?.assigneeId) {
        const assignee = users.get(card.assigneeId);

        await this.createForAudience({
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          actorUserId: params.actorUserId,
          type: NotificationType.TaskAssigned,
          payload: {
            ...shared,
            assigneeId: card.assigneeId,
            assigneeUsername: assignee?.username ?? 'someone',
          },
        });
      }

      if (previous && previous.columnId !== card.columnId) {
        await this.createForAudience({
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          actorUserId: params.actorUserId,
          type: NotificationType.TaskStatusChanged,
          payload: {
            ...shared,
            columnId: card.columnId,
            columnName: card.columnName,
            previousColumnName: previous.columnName,
            assigneeId: card.assigneeId ?? undefined,
          },
        });
      }
    }
  }

  private async createForAudience(params: {
    workspaceId: string;
    projectId?: string;
    actorUserId: string;
    type: NotificationType;
    payload: NotificationPayload;
  }): Promise<void> {
    const recipientIds = params.projectId
      ? await this.getProjectRecipientIds(params.projectId, params.actorUserId)
      : await this.getWorkspaceRecipientIds(
          params.workspaceId,
          params.actorUserId,
        );

    if (recipientIds.length === 0) {
      return;
    }

    const notifications = await this.notificationsRepository.save(
      recipientIds.map((userId) =>
        this.notificationsRepository.create({
          userId,
          workspaceId: params.workspaceId,
          type: params.type,
          payload: params.payload,
          readAt: null,
        }),
      ),
    );

    for (const notification of notifications) {
      this.realtimeService.emitToUser(
        notification.userId,
        RealtimeEvent.NOTIFICATION_CREATED,
        { notification: this.toResponse(notification) },
      );
    }
  }

  private async getWorkspaceRecipientIds(
    workspaceId: string,
    actorUserId: string,
  ): Promise<string[]> {
    const members = await this.membersRepository.find({
      where: {
        workspaceId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { userId: true },
    });

    return members
      .map((member) => member.userId)
      .filter((userId) => userId !== actorUserId);
  }

  private async getProjectRecipientIds(
    projectId: string,
    actorUserId: string,
  ): Promise<string[]> {
    const members = await this.projectMembersRepository.find({
      where: { projectId },
      select: { userId: true },
    });

    return members
      .map((member) => member.userId)
      .filter((userId) => userId !== actorUserId);
  }

  private async findUserMap(
    userIds: string[],
  ): Promise<Map<string, UserEntity>> {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
      return new Map();
    }

    const users = await this.usersRepository.find({
      where: { id: In(uniqueIds) },
    });

    return new Map(users.map((user) => [user.id, user]));
  }

  private async getWorkspaceName(workspaceId: string): Promise<string> {
    const workspace = await this.workspacesRepository.findOne({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });

    return workspace?.name ?? 'Workspace';
  }

  private async countUnread(userId: string): Promise<number> {
    return this.notificationsRepository.count({
      where: { userId, readAt: IsNull() },
    });
  }

  private toResponse(
    notification: NotificationEntity,
  ): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      workspaceId: notification.workspaceId,
      payload: notification.payload,
      isRead: Boolean(notification.readAt),
      createdAt: notification.createdAt,
    };
  }
}
