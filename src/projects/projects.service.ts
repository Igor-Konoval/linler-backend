import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import { FileService } from 'src/common/services/file.service';
import { WorkspaceMemberEntity } from 'src/workspaces/entities/workspace-member.entity';
import {
  WorkspaceMemberStatus,
  WorkspaceRole,
} from 'src/workspaces/enums/workspace.enums';
import { ProjectEntity } from './entities/project.entity';
import { ProjectMemberEntity } from './entities/project-member.entity';
import { ProjectRole, ProjectVisibility } from './enums/project.enums';
import { PageEntity } from 'src/pages/entities/page.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SetDefaultPageDto } from './dto/set-default-page.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { ProjectMemberResponseDto } from './dto/project-member-response.dto';
import { WORKSPACE_ADMIN_ROLES } from './constants/project.constants';

interface ProjectAccess {
  project: ProjectEntity;
  role: ProjectRole;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectsRepository: Repository<ProjectEntity>,
    @InjectRepository(ProjectMemberEntity)
    private readonly projectMembersRepository: Repository<ProjectMemberEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMembersRepository: Repository<WorkspaceMemberEntity>,
    private readonly fileService: FileService,
  ) {}

  async createProject(
    userId: string,
    workspaceId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    const workspaceMembership = await this.getActiveWorkspaceMembership(
      workspaceId,
      userId,
    );

    if (!WORKSPACE_ADMIN_ROLES.includes(workspaceMembership.role)) {
      throw new ForbiddenException(ERROR_MESSAGES.WORKSPACE_INSUFFICIENT_ROLE);
    }

    const project = await this.projectsRepository.manager.transaction(
      async (manager) => {
        const created = await manager.save(
          manager.create(ProjectEntity, {
            workspaceId,
            ownerId: userId,
            name: dto.name,
            icon: dto.icon ?? null,
            description: dto.description ?? null,
            visibility: dto.visibility ?? ProjectVisibility.PRIVATE,
          }),
        );

        await manager.save(
          manager.create(ProjectMemberEntity, {
            projectId: created.id,
            userId,
            role: ProjectRole.OWNER,
          }),
        );

        const defaultPage = await manager.save(
          manager.create(PageEntity, {
            projectId: created.id,
            parentPageId: null,
            title: 'Untitled',
            icon: '📄',
            cover: null,
            coverMeta: null,
            width: 1280,
            height: 320,
            objectPositionX: 50,
            objectPositionY: 50,
            editorMeta: null,
            contentWidth: 720,
            contentOffsetX: 0,
            content: {
              type: 'doc',
              content: [],
            },
            orderIndex: 0,
            isArchived: false,
            createdById: userId,
            updatedById: userId,
          }),
        );

        created.defaultPageId = defaultPage.id;
        await manager.save(created);

        return created;
      },
    );

    return this.toProjectResponse(project, ProjectRole.OWNER);
  }

  async listProjects(
    userId: string,
    workspaceId: string,
  ): Promise<ProjectResponseDto[]> {
    const workspaceMembership = await this.getActiveWorkspaceMembership(
      workspaceId,
      userId,
    );

    const projects = await this.projectsRepository.find({
      where: { workspaceId, isArchived: false },
      order: { orderIndex: 'ASC', createdAt: 'ASC' },
    });

    const membershipByProjectId = await this.getProjectMembershipMap(
      userId,
      projects.map((project) => project.id),
    );

    const result: ProjectResponseDto[] = [];

    for (const project of projects) {
      const role = this.computeEffectiveRole(
        project,
        workspaceMembership.role,
        membershipByProjectId.get(project.id),
      );

      if (role !== null) {
        result.push(this.toProjectResponse(project, role));
      }
    }

    return result;
  }

  async getProject(
    userId: string,
    projectId: string,
  ): Promise<ProjectResponseDto> {
    const access = await this.resolveAccess(projectId, userId);

    return this.toProjectResponse(access.project, access.role);
  }

  async updateProject(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    const access = await this.resolveAccess(projectId, userId);
    this.assertOwner(access);

    const project = access.project;

    Object.assign(project, dto);

    const saved = await this.projectsRepository.save(project);

    return this.toProjectResponse(saved, access.role);
  }

  async setDefaultPage(
    userId: string,
    projectId: string,
    dto: SetDefaultPageDto,
  ): Promise<ProjectResponseDto> {
    const access = await this.resolveAccess(projectId, userId);
    this.assertOwner(access);

    if (dto.pageId === null) {
      access.project.defaultPageId = null;
      const saved = await this.projectsRepository.save(access.project);
      return this.toProjectResponse(saved, access.role);
    }

    const page = await this.projectsRepository.manager.findOne(PageEntity, {
      where: {
        id: dto.pageId,
        projectId,
      },
      select: {
        id: true,
        isArchived: true,
      },
    });

    if (!page || page.isArchived) {
      throw new NotFoundException(ERROR_MESSAGES.PAGE_NOT_FOUND);
    }

    access.project.defaultPageId = page.id;
    const saved = await this.projectsRepository.save(access.project);
    return this.toProjectResponse(saved, access.role);
  }

  async deleteProject(userId: string, projectId: string): Promise<void> {
    const access = await this.resolveAccess(projectId, userId);
    this.assertOwner(access);

    await this.projectsRepository.delete({ id: projectId });
  }

  async listMembers(
    userId: string,
    projectId: string,
  ): Promise<ProjectMemberResponseDto[]> {
    await this.resolveAccess(projectId, userId);

    const members = await this.projectMembersRepository.find({
      where: { projectId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return members.map((member) => this.toMemberResponse(member));
  }

  async getProjectMemberUserIds(projectId: string): Promise<Set<string>> {
    const members = await this.projectMembersRepository.find({
      where: { projectId },
      select: {
        id: true,
        userId: true,
      },
    });

    return new Set(members.map((member) => member.userId));
  }

  async addMember(
    userId: string,
    projectId: string,
    dto: AddProjectMemberDto,
  ): Promise<ProjectMemberResponseDto> {
    const access = await this.resolveAccess(projectId, userId);
    this.assertOwner(access);

    const targetWorkspaceMembership =
      await this.workspaceMembersRepository.findOne({
        where: {
          workspaceId: access.project.workspaceId,
          userId: dto.userId,
          status: WorkspaceMemberStatus.ACTIVE,
        },
      });

    if (!targetWorkspaceMembership) {
      throw new ForbiddenException(
        ERROR_MESSAGES.PROJECT_MEMBER_NOT_IN_WORKSPACE,
      );
    }

    const existing = await this.projectMembersRepository.findOne({
      where: { projectId, userId: dto.userId },
    });

    if (existing) {
      throw new ConflictException(ERROR_MESSAGES.PROJECT_MEMBER_ALREADY_EXISTS);
    }

    const saved = await this.projectMembersRepository.save(
      this.projectMembersRepository.create({
        projectId,
        userId: dto.userId,
        role: dto.role ?? ProjectRole.VIEWER,
      }),
    );

    const withUser = await this.projectMembersRepository.findOne({
      where: { id: saved.id },
      relations: { user: true },
    });

    return this.toMemberResponse(withUser ?? saved);
  }

  async updateMember(
    userId: string,
    projectId: string,
    targetUserId: string,
    dto: UpdateProjectMemberDto,
  ): Promise<ProjectMemberResponseDto> {
    const access = await this.resolveAccess(projectId, userId);
    this.assertOwner(access);

    const target = await this.projectMembersRepository.findOne({
      where: { projectId, userId: targetUserId },
      relations: { user: true },
    });

    if (!target) {
      throw new NotFoundException(ERROR_MESSAGES.PROJECT_MEMBER_NOT_FOUND);
    }

    if (target.role === ProjectRole.OWNER) {
      throw new ForbiddenException(ERROR_MESSAGES.PROJECT_INSUFFICIENT_ROLE);
    }

    target.role = dto.role;
    const saved = await this.projectMembersRepository.save(target);

    return this.toMemberResponse(saved);
  }

  async removeMember(
    userId: string,
    projectId: string,
    targetUserId: string,
  ): Promise<void> {
    const access = await this.resolveAccess(projectId, userId);
    this.assertOwner(access);

    if (targetUserId === access.project.ownerId) {
      throw new ForbiddenException(
        ERROR_MESSAGES.PROJECT_OWNER_CANNOT_BE_REMOVED,
      );
    }

    const target = await this.projectMembersRepository.findOne({
      where: { projectId, userId: targetUserId },
    });

    if (!target) {
      throw new NotFoundException(ERROR_MESSAGES.PROJECT_MEMBER_NOT_FOUND);
    }

    await this.projectMembersRepository.delete({ id: target.id });
  }

  private async resolveAccess(
    projectId: string,
    userId: string,
  ): Promise<ProjectAccess> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(ERROR_MESSAGES.PROJECT_NOT_FOUND);
    }

    const workspaceMembership = await this.workspaceMembersRepository.findOne({
      where: {
        workspaceId: project.workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
    });

    if (!workspaceMembership) {
      throw new ForbiddenException(ERROR_MESSAGES.PROJECT_ACCESS_DENIED);
    }

    const projectMembership = await this.projectMembersRepository.findOne({
      where: { projectId, userId },
    });

    const role = this.computeEffectiveRole(
      project,
      workspaceMembership.role,
      projectMembership ?? undefined,
    );

    if (role === null) {
      throw new ForbiddenException(ERROR_MESSAGES.PROJECT_ACCESS_DENIED);
    }

    return { project, role };
  }

  private computeEffectiveRole(
    project: ProjectEntity,
    workspaceRole: WorkspaceRole,
    projectMembership?: ProjectMemberEntity,
  ): ProjectRole | null {
    if (WORKSPACE_ADMIN_ROLES.includes(workspaceRole)) {
      return ProjectRole.OWNER;
    }

    if (projectMembership) {
      return projectMembership.role;
    }

    if (project.visibility === ProjectVisibility.WORKSPACE) {
      return workspaceRole === WorkspaceRole.VIEWER
        ? ProjectRole.VIEWER
        : ProjectRole.EDITOR;
    }

    return null;
  }

  private assertOwner(access: ProjectAccess): void {
    if (access.role !== ProjectRole.OWNER) {
      throw new ForbiddenException(ERROR_MESSAGES.PROJECT_INSUFFICIENT_ROLE);
    }
  }

  private async getActiveWorkspaceMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberEntity> {
    const membership = await this.workspaceMembersRepository.findOne({
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

  private async getProjectMembershipMap(
    userId: string,
    projectIds: string[],
  ): Promise<Map<string, ProjectMemberEntity>> {
    if (projectIds.length === 0) {
      return new Map();
    }

    const memberships = await this.projectMembersRepository.find({
      where: { userId, projectId: In(projectIds) },
    });

    return new Map(
      memberships.map((membership) => [membership.projectId, membership]),
    );
  }

  private toProjectResponse(
    project: ProjectEntity,
    role: ProjectRole,
  ): ProjectResponseDto {
    return {
      id: project.id,
      workspaceId: project.workspaceId,
      ownerId: project.ownerId,
      defaultPageId: project.defaultPageId,
      name: project.name,
      icon: project.icon,
      description: project.description,
      visibility: project.visibility,
      orderIndex: project.orderIndex,
      isArchived: project.isArchived,
      role,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private toMemberResponse(
    member: ProjectMemberEntity,
  ): ProjectMemberResponseDto {
    return {
      id: member.id,
      userId: member.userId,
      email: member.user?.email ?? '',
      username: member.user?.username ?? '',
      avatarUrl: this.fileService.getFullAvatarUrl(
        member.user?.avatarUrl ?? null,
      ),
      role: member.role,
      createdAt: member.createdAt,
    };
  }
}
