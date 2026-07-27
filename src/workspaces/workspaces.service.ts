import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { In, IsNull, MoreThan } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import { FileService } from 'src/common/services/file.service';
import { hashToken } from 'src/modules/auth/utils/token-hash.utils';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { buildPageMeta } from 'src/common/utils/pagination.util';
import { WorkspaceEntity } from './entities/workspace.entity';
import { WorkspaceMemberEntity } from './entities/workspace-member.entity';
import { WorkspaceInvitationEntity } from './entities/workspace-invitation.entity';
import {
  WorkspaceInvitationStatus,
  WorkspaceMemberStatus,
  WorkspaceRole,
} from './enums/workspace.enums';
import { slugify } from './utils/slug.util';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { WorkspaceResponseDto } from './dto/workspace-response.dto';
import { WorkspaceMemberResponseDto } from './dto/workspace-member-response.dto';
import { WorkspaceInvitationResponseDto } from './dto/workspace-invitation-response.dto';
import { WorkspaceInvitationListResponseDto } from './dto/workspace-invitation-list-response.dto';
import { CreatedInvitationResponseDto } from './dto/created-invitation-response.dto';
import { MyInvitationResponseDto } from './dto/my-invitation-response.dto';
import { MyInvitationListResponseDto } from './dto/my-invitation-list-response.dto';
import { UnreadCountResponseDto } from './dto/unread-count-response.dto';
import { MarkInvitationsReadDto } from './dto/mark-invitations-read.dto';
import {
  INVITATION_TTL_MS,
  MANAGER_ROLES,
  MY_INBOX_STATUSES,
} from './constants/workspace.constants';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspacesRepository: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly membersRepository: Repository<WorkspaceMemberEntity>,
    @InjectRepository(WorkspaceInvitationEntity)
    private readonly invitationsRepository: Repository<WorkspaceInvitationEntity>,
    private readonly fileService: FileService,
  ) {}

  async ensurePersonalWorkspace(
    userId: string,
    username: string,
  ): Promise<WorkspaceEntity> {
    return this.createWorkspaceWithOwner(userId, `${username}'s Workspace`);
  }

  async createWorkspace(
    userId: string,
    dto: CreateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    const workspace = await this.createWorkspaceWithOwner(userId, dto.name);

    return this.toWorkspaceResponse(workspace, WorkspaceRole.OWNER);
  }

  async findUserWorkspaces(userId: string): Promise<WorkspaceResponseDto[]> {
    const memberships = await this.membersRepository.find({
      where: {
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      relations: { workspace: true },
      order: { joinedAt: 'ASC' },
    });

    return memberships.map((membership) =>
      this.toWorkspaceResponse(membership.workspace, membership.role),
    );
  }

  async getWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceResponseDto> {
    const membership = await this.getActiveMembershipOrThrow(
      workspaceId,
      userId,
    );

    const workspace = await this.workspacesRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
    }

    return this.toWorkspaceResponse(workspace, membership.role);
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    const membership = await this.getActiveMembershipOrThrow(
      workspaceId,
      userId,
    );
    this.assertManager(membership);

    const workspace = await this.workspacesRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
    }

    if (dto.name !== undefined) {
      workspace.name = dto.name;
    }

    const saved = await this.workspacesRepository.save(workspace);

    return this.toWorkspaceResponse(saved, membership.role);
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    const membership = await this.getActiveMembershipOrThrow(
      workspaceId,
      userId,
    );

    if (membership.role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException(ERROR_MESSAGES.WORKSPACE_INSUFFICIENT_ROLE);
    }

    await this.workspacesRepository.delete({ id: workspaceId });
  }

  async listMembers(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberResponseDto[]> {
    await this.getActiveMembershipOrThrow(workspaceId, userId);

    const members = await this.membersRepository.find({
      where: { workspaceId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });

    return members.map((member) => this.toMemberResponse(member));
  }

  async updateMember(
    workspaceId: string,
    actorUserId: string,
    targetUserId: string,
    dto: UpdateMemberDto,
  ): Promise<WorkspaceMemberResponseDto> {
    const actorMembership = await this.getActiveMembershipOrThrow(
      workspaceId,
      actorUserId,
    );
    this.assertManager(actorMembership);

    const target = await this.membersRepository.findOne({
      where: { workspaceId, userId: targetUserId },
      relations: { user: true },
    });

    if (!target) {
      throw new NotFoundException(ERROR_MESSAGES.WORKSPACE_MEMBER_NOT_FOUND);
    }

    if (target.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException(ERROR_MESSAGES.WORKSPACE_INSUFFICIENT_ROLE);
    }

    if (
      actorMembership.role !== WorkspaceRole.OWNER &&
      dto.role === WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(ERROR_MESSAGES.WORKSPACE_INSUFFICIENT_ROLE);
    }

    if (dto.role !== undefined) {
      target.role = dto.role;
    }

    if (dto.status !== undefined) {
      target.status = dto.status;
    }

    const saved = await this.membersRepository.save(target);

    return this.toMemberResponse(saved);
  }

  async removeMember(
    workspaceId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const actorMembership = await this.getActiveMembershipOrThrow(
      workspaceId,
      actorUserId,
    );
    this.assertManager(actorMembership);

    const target = await this.membersRepository.findOne({
      where: { workspaceId, userId: targetUserId },
    });

    if (!target) {
      throw new NotFoundException(ERROR_MESSAGES.WORKSPACE_MEMBER_NOT_FOUND);
    }

    if (target.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException(ERROR_MESSAGES.WORKSPACE_OWNER_CANNOT_LEAVE);
    }

    await this.membersRepository.delete({ id: target.id });
  }

  async leaveWorkspace(workspaceId: string, userId: string): Promise<void> {
    const membership = await this.getActiveMembershipOrThrow(
      workspaceId,
      userId,
    );

    if (membership.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException(ERROR_MESSAGES.WORKSPACE_OWNER_CANNOT_LEAVE);
    }

    await this.membersRepository.delete({ id: membership.id });
  }

  async createInvitation(
    workspaceId: string,
    actorUserId: string,
    dto: InviteMemberDto,
  ): Promise<CreatedInvitationResponseDto> {
    const actorMembership = await this.getActiveMembershipOrThrow(
      workspaceId,
      actorUserId,
    );
    this.assertManager(actorMembership);

    const email = dto.email.toLowerCase();

    const existingMember = await this.membersRepository
      .createQueryBuilder('member')
      .innerJoin('member.user', 'user')
      .where('member.workspace_id = :workspaceId', { workspaceId })
      .andWhere('LOWER(user.email) = :email', { email })
      .getOne();

    if (existingMember) {
      throw new ConflictException(
        ERROR_MESSAGES.WORKSPACE_MEMBER_ALREADY_EXISTS,
      );
    }

    const existingPendingInvitation = await this.invitationsRepository.findOne({
      where: {
        workspaceId,
        email,
        status: WorkspaceInvitationStatus.PENDING,
      },
    });

    if (existingPendingInvitation) {
      throw new ConflictException(
        ERROR_MESSAGES.WORKSPACE_INVITATION_ALREADY_EXISTS,
      );
    }

    const rawToken = randomBytes(32).toString('hex');

    const invitation = this.invitationsRepository.create({
      workspaceId,
      email,
      role: dto.role ?? WorkspaceRole.MEMBER,
      tokenHash: hashToken(rawToken),
      status: WorkspaceInvitationStatus.PENDING,
      invitedById: actorUserId,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      acceptedAt: null,
      readAt: null,
    });

    const saved = await this.invitationsRepository.save(invitation);

    return {
      ...this.toInvitationResponse(saved),
      token: rawToken,
    };
  }

  async listInvitations(
    workspaceId: string,
    userId: string,
    pagination: PaginationQueryDto,
  ): Promise<WorkspaceInvitationListResponseDto> {
    const membership = await this.getActiveMembershipOrThrow(
      workspaceId,
      userId,
    );
    this.assertManager(membership);

    const { page, limit } = pagination;

    const [invitations, totalItems] =
      await this.invitationsRepository.findAndCount({
        where: {
          workspaceId,
          status: WorkspaceInvitationStatus.PENDING,
        },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    return {
      invitations: invitations.map((invitation) =>
        this.toInvitationResponse(invitation),
      ),
      meta: buildPageMeta(totalItems, page, limit),
    };
  }

  async revokeInvitation(
    workspaceId: string,
    userId: string,
    invitationId: string,
  ): Promise<void> {
    const membership = await this.getActiveMembershipOrThrow(
      workspaceId,
      userId,
    );
    this.assertManager(membership);

    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId, workspaceId },
    });

    if (!invitation) {
      throw new NotFoundException(
        ERROR_MESSAGES.WORKSPACE_INVITATION_NOT_FOUND,
      );
    }

    invitation.status = WorkspaceInvitationStatus.REVOKED;
    await this.invitationsRepository.save(invitation);
  }

  async findMyInvitations(
    userEmail: string,
    pagination: PaginationQueryDto,
  ): Promise<MyInvitationListResponseDto> {
    const email = userEmail.toLowerCase();
    const { page, limit } = pagination;

    const [invitations, totalItems] =
      await this.invitationsRepository.findAndCount({
        where: {
          email,
          status: In(MY_INBOX_STATUSES),
        },
        relations: { workspace: true },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    const items: MyInvitationResponseDto[] = invitations.map((invitation) => ({
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspace?.name ?? '',
      role: invitation.role,
      status: invitation.status,
      isRead: invitation.readAt !== null,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    }));

    const unreadCount = await this.invitationsRepository.count({
      where: {
        email,
        status: WorkspaceInvitationStatus.PENDING,
        readAt: IsNull(),
      },
    });

    return {
      invitations: items,
      unreadCount,
      meta: buildPageMeta(totalItems, page, limit),
    };
  }

  async markInvitationsRead(
    userEmail: string,
    dto: MarkInvitationsReadDto,
  ): Promise<UnreadCountResponseDto> {
    const email = userEmail.toLowerCase();

    await this.invitationsRepository.update(
      { id: In(dto.invitationIds), email, readAt: IsNull() },
      { readAt: new Date() },
    );

    const unreadCount = await this.invitationsRepository.count({
      where: {
        email,
        status: WorkspaceInvitationStatus.PENDING,
        readAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    return { unreadCount };
  }

  async markAllInvitationsRead(
    userEmail: string,
  ): Promise<UnreadCountResponseDto> {
    await this.invitationsRepository.update(
      {
        email: userEmail.toLowerCase(),
        status: WorkspaceInvitationStatus.PENDING,
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );

    return { unreadCount: 0 };
  }

  async acceptInvitationByToken(
    userId: string,
    userEmail: string,
    token: string,
  ): Promise<WorkspaceResponseDto> {
    const invitation = await this.invitationsRepository.findOne({
      where: { tokenHash: hashToken(token) },
    });

    return this.applyInvitationAcceptance(invitation, userId, userEmail);
  }

  async acceptInvitationById(
    userId: string,
    userEmail: string,
    invitationId: string,
  ): Promise<WorkspaceResponseDto> {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
    });

    return this.applyInvitationAcceptance(invitation, userId, userEmail);
  }

  async declineInvitation(
    userEmail: string,
    invitationId: string,
  ): Promise<void> {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException(
        ERROR_MESSAGES.WORKSPACE_INVITATION_NOT_FOUND,
      );
    }

    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        ERROR_MESSAGES.WORKSPACE_INVITATION_EMAIL_MISMATCH,
      );
    }

    this.assertInvitationIsPending(invitation);

    invitation.status = WorkspaceInvitationStatus.DECLINED;
    await this.invitationsRepository.save(invitation);
  }

  private async applyInvitationAcceptance(
    invitation: WorkspaceInvitationEntity | null,
    userId: string,
    userEmail: string,
  ): Promise<WorkspaceResponseDto> {
    if (!invitation) {
      throw new NotFoundException(
        ERROR_MESSAGES.WORKSPACE_INVITATION_NOT_FOUND,
      );
    }

    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        ERROR_MESSAGES.WORKSPACE_INVITATION_EMAIL_MISMATCH,
      );
    }

    this.assertInvitationIsPending(invitation);

    if (invitation.expiresAt.getTime() <= Date.now()) {
      invitation.status = WorkspaceInvitationStatus.EXPIRED;
      await this.invitationsRepository.save(invitation);

      throw new ForbiddenException(ERROR_MESSAGES.WORKSPACE_INVITATION_EXPIRED);
    }

    const membership = await this.membersRepository.findOne({
      where: { workspaceId: invitation.workspaceId, userId },
    });

    const role = membership?.role ?? invitation.role;

    if (membership) {
      membership.status = WorkspaceMemberStatus.ACTIVE;
      await this.membersRepository.save(membership);
    } else {
      await this.membersRepository.save(
        this.membersRepository.create({
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          status: WorkspaceMemberStatus.ACTIVE,
        }),
      );
    }

    invitation.status = WorkspaceInvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();
    await this.invitationsRepository.save(invitation);

    const workspace = await this.workspacesRepository.findOne({
      where: { id: invitation.workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
    }

    return this.toWorkspaceResponse(workspace, role);
  }

  private assertInvitationIsPending(
    invitation: WorkspaceInvitationEntity,
  ): void {
    switch (invitation.status) {
      case WorkspaceInvitationStatus.PENDING:
        return;
      case WorkspaceInvitationStatus.ACCEPTED:
        throw new ConflictException(
          ERROR_MESSAGES.WORKSPACE_INVITATION_ALREADY_ACCEPTED,
        );
      case WorkspaceInvitationStatus.DECLINED:
        throw new ConflictException(
          ERROR_MESSAGES.WORKSPACE_INVITATION_ALREADY_DECLINED,
        );
      case WorkspaceInvitationStatus.REVOKED:
        throw new ConflictException(
          ERROR_MESSAGES.WORKSPACE_INVITATION_REVOKED,
        );
      case WorkspaceInvitationStatus.EXPIRED:
        throw new ForbiddenException(
          ERROR_MESSAGES.WORKSPACE_INVITATION_EXPIRED,
        );
      default:
        throw new NotFoundException(
          ERROR_MESSAGES.WORKSPACE_INVITATION_NOT_FOUND,
        );
    }
  }

  private async createWorkspaceWithOwner(
    ownerId: string,
    name: string,
  ): Promise<WorkspaceEntity> {
    return this.workspacesRepository.manager.transaction(async (manager) => {
      const slug = await this.generateUniqueSlug(manager, slugify(name));

      const workspace = await manager.save(
        manager.create(WorkspaceEntity, {
          name,
          slug,
          ownerId,
        }),
      );

      await manager.save(
        manager.create(WorkspaceMemberEntity, {
          workspaceId: workspace.id,
          userId: ownerId,
          role: WorkspaceRole.OWNER,
          status: WorkspaceMemberStatus.ACTIVE,
        }),
      );

      return workspace;
    });
  }

  private async generateUniqueSlug(
    manager: EntityManager,
    base: string,
  ): Promise<string> {
    let candidate = base;
    let counter = 1;

    while (
      (await manager.count(WorkspaceEntity, {
        where: { slug: candidate },
      })) > 0
    ) {
      counter += 1;
      candidate = `${base}-${counter}`;
    }

    return candidate;
  }

  private async getActiveMembershipOrThrow(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberEntity> {
    const membership = await this.membersRepository.findOne({
      where: {
        workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
    });

    if (!membership) {
      throw new ForbiddenException(ERROR_MESSAGES.WORKSPACE_ACCESS_DENIED);
    }

    return membership;
  }

  private assertManager(membership: WorkspaceMemberEntity): void {
    if (!MANAGER_ROLES.includes(membership.role)) {
      throw new ForbiddenException(ERROR_MESSAGES.WORKSPACE_INSUFFICIENT_ROLE);
    }
  }

  private toWorkspaceResponse(
    workspace: WorkspaceEntity,
    role: WorkspaceRole,
  ): WorkspaceResponseDto {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      ownerId: workspace.ownerId,
      role,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  private toMemberResponse(
    member: WorkspaceMemberEntity,
  ): WorkspaceMemberResponseDto {
    return {
      id: member.id,
      userId: member.userId,
      email: member.user?.email ?? '',
      username: member.user?.username ?? '',
      avatarUrl: this.fileService.getFullAvatarUrl(
        member.user?.avatarUrl ?? null,
      ),
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
    };
  }

  private toInvitationResponse(
    invitation: WorkspaceInvitationEntity,
  ): WorkspaceInvitationResponseDto {
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }
}
