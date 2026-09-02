import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import { FileService } from 'src/common/services/file.service';
import { ProjectsService } from 'src/projects/projects.service';
import { ProjectRole } from 'src/projects/enums/project.enums';
import { ProjectEntity } from 'src/projects/entities/project.entity';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PageResponseDto } from './dto/page-response.dto';
import { PageTreeItemResponseDto } from './dto/page-tree-item-response.dto';
import { PageEntity } from './entities/page.entity';
import { PageAttachmentEntity } from './entities/page-attachment.entity';
import { PageAttachmentResponseDto } from './dto/page-attachment-response.dto';
import { PermanentDeletePageDto } from './dto/permanent-delete-page.dto';
import {
  PAGE_WRITE_ROLES,
  PermanentDeleteChildrenStrategy,
} from './constants/pages.constants';
import { sanitizePageContent } from './utils/sanitize-page-content.util';

interface PageAccess {
  page: PageEntity;
  role: ProjectRole;
}

interface ResolvePageAccessOptions {
  allowArchived?: boolean;
}

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(PageEntity)
    private readonly pagesRepository: Repository<PageEntity>,
    @InjectRepository(PageAttachmentEntity)
    private readonly attachmentsRepository: Repository<PageAttachmentEntity>,
    private readonly projectsService: ProjectsService,
    private readonly fileService: FileService,
  ) {}

  async createPage(
    userId: string,
    projectId: string,
    dto: CreatePageDto,
  ): Promise<PageResponseDto> {
    const project = await this.projectsService.getProject(userId, projectId);
    this.assertCanEdit(project.role);

    let parentPageId: string | null = null;
    if (dto.parentPageId !== undefined && dto.parentPageId !== null) {
      await this.ensureParentInProject(projectId, dto.parentPageId);
      parentPageId = dto.parentPageId;
    }

    const page = this.pagesRepository.create({
      projectId,
      parentPageId,
      title: dto.title,
      icon: dto.icon ?? null,
      cover: null,
      coverMeta: null,
      width: 1280,
      height: 320,
      objectPositionX: 50,
      objectPositionY: 50,
      editorMeta: null,
      contentWidth: 720,
      contentOffsetX: 0,
      content: this.getEmptyDocument(),
      orderIndex: 0,
      createdById: userId,
      updatedById: userId,
    });

    const saved = await this.pagesRepository.save(page);

    return this.toResponse(saved, project.role, []);
  }

  async listProjectPages(
    userId: string,
    projectId: string,
  ): Promise<PageTreeItemResponseDto[]> {
    await this.projectsService.getProject(userId, projectId);

    const pages = await this.pagesRepository.find({
      where: { projectId, isArchived: false },
      select: {
        id: true,
        parentPageId: true,
        title: true,
        icon: true,
        orderIndex: true,
        isArchived: true,
      },
      order: {
        orderIndex: 'ASC',
        createdAt: 'ASC',
      },
    });

    return pages.map((page) => this.toTreeItemResponse(page));
  }

  async getPage(userId: string, pageId: string): Promise<PageResponseDto> {
    const access = await this.resolveAccess(pageId, userId);
    const attachments = await this.listAttachments(userId, pageId);

    return this.toResponse(access.page, access.role, attachments);
  }

  async updatePage(
    userId: string,
    pageId: string,
    dto: UpdatePageDto,
  ): Promise<PageResponseDto> {
    const access = await this.resolveAccess(pageId, userId, {
      allowArchived: true,
    });
    this.assertCanEdit(access.role);

    const page = access.page;

    if (dto.parentPageId !== undefined) {
      if (dto.parentPageId === null) {
        page.parentPageId = null;
      } else {
        await this.ensureParentInProject(page.projectId, dto.parentPageId);
        await this.assertNoParentCycle(
          page.id,
          dto.parentPageId,
          page.projectId,
        );
        page.parentPageId = dto.parentPageId;
      }
    }

    if (dto.title !== undefined) {
      page.title = dto.title;
    }

    if (dto.icon !== undefined) {
      page.icon = dto.icon;
    }

    if (dto.cover !== undefined) {
      page.cover = dto.cover;

      if (dto.cover === null) {
        page.coverMeta = null;
      }
    }

    if (dto.coverMeta !== undefined) {
      page.coverMeta = dto.coverMeta;
    }

    if (dto.editorMeta !== undefined) {
      page.editorMeta = dto.editorMeta;
    }

    if (dto.width !== undefined) {
      page.width = dto.width;
    }

    if (dto.height !== undefined) {
      page.height = dto.height;
    }

    if (dto.objectPositionX !== undefined) {
      page.objectPositionX = dto.objectPositionX;
    }

    if (dto.objectPositionY !== undefined) {
      page.objectPositionY = dto.objectPositionY;
    }

    if (dto.contentWidth !== undefined) {
      page.contentWidth = dto.contentWidth;
    } else {
      const contentWidthFromMeta = this.getNumericMetaValue(
        dto.editorMeta,
        'contentWidth',
      );

      if (contentWidthFromMeta !== undefined) {
        page.contentWidth = contentWidthFromMeta;
      }
    }

    if (dto.contentOffsetX !== undefined) {
      page.contentOffsetX = dto.contentOffsetX;
    } else {
      const contentOffsetFromMeta = this.getNumericMetaValue(
        dto.editorMeta,
        'contentOffsetX',
      );

      if (contentOffsetFromMeta !== undefined) {
        page.contentOffsetX = contentOffsetFromMeta;
      }
    }

    if (dto.content !== undefined) {
      const assignableUserIds =
        await this.projectsService.getProjectMemberUserIds(page.projectId);
      page.content = sanitizePageContent(dto.content, assignableUserIds);
    }

    if (dto.orderIndex !== undefined) {
      page.orderIndex = dto.orderIndex;
    }

    if (dto.isArchived !== undefined) {
      page.isArchived = dto.isArchived;

      if (dto.isArchived) {
        await this.clearProjectDefaultPageIfMatches(page.projectId, page.id);
      }
    }

    page.updatedById = userId;

    const saved = await this.pagesRepository.save(page);
    const attachments = await this.listAttachments(userId, pageId);

    return this.toResponse(saved, access.role, attachments);
  }

  async archivePage(userId: string, pageId: string): Promise<void> {
    const access = await this.resolveAccess(pageId, userId, {
      allowArchived: true,
    });
    this.assertCanEdit(access.role);

    if (access.page.isArchived) {
      return;
    }

    access.page.isArchived = true;
    access.page.updatedById = userId;
    await this.pagesRepository.save(access.page);

    await this.clearProjectDefaultPageIfMatches(
      access.page.projectId,
      access.page.id,
    );
  }

  async permanentDeletePage(
    userId: string,
    pageId: string,
    dto: PermanentDeletePageDto,
  ): Promise<void> {
    const access = await this.resolveAccess(pageId, userId, {
      allowArchived: true,
    });
    this.assertCanEdit(access.role);

    if (!access.page.isArchived) {
      throw new BadRequestException(
        ERROR_MESSAGES.PAGE_MUST_BE_ARCHIVED_BEFORE_PERMANENT_DELETE,
      );
    }

    const directChildren = await this.pagesRepository.find({
      where: {
        projectId: access.page.projectId,
        parentPageId: access.page.id,
      },
      select: {
        id: true,
      },
    });

    if (directChildren.length > 0 && dto.strategy === undefined) {
      throw new BadRequestException(
        ERROR_MESSAGES.PAGE_DELETE_CHILDREN_STRATEGY_REQUIRED,
      );
    }

    await this.pagesRepository.manager.transaction(async (manager) => {
      const page = await manager.findOne(PageEntity, {
        where: { id: pageId },
      });

      if (!page) {
        throw new NotFoundException(ERROR_MESSAGES.PAGE_NOT_FOUND);
      }

      let deletedPageIds: string[] = [page.id];

      if (directChildren.length > 0) {
        switch (dto.strategy) {
          case PermanentDeleteChildrenStrategy.DELETE_SUBTREE: {
            const allProjectPages = await manager.find(PageEntity, {
              where: { projectId: page.projectId },
              select: {
                id: true,
                parentPageId: true,
              },
            });

            deletedPageIds = this.collectSubtreeIds(allProjectPages, page.id);

            await manager.delete(PageEntity, {
              id: In(deletedPageIds),
            });
            break;
          }

          case PermanentDeleteChildrenStrategy.MOVE_CHILDREN_TO_PARENT: {
            await manager.update(
              PageEntity,
              {
                projectId: page.projectId,
                parentPageId: page.id,
              },
              {
                parentPageId: page.parentPageId,
                updatedById: userId,
              },
            );

            await manager.delete(PageEntity, { id: page.id });
            break;
          }

          case PermanentDeleteChildrenStrategy.MAKE_CHILDREN_ROOT: {
            await manager.update(
              PageEntity,
              {
                projectId: page.projectId,
                parentPageId: page.id,
              },
              {
                parentPageId: null,
                updatedById: userId,
              },
            );

            await manager.delete(PageEntity, { id: page.id });
            break;
          }

          default: {
            throw new BadRequestException(
              ERROR_MESSAGES.PAGE_DELETE_CHILDREN_STRATEGY_REQUIRED,
            );
          }
        }
      } else {
        await manager.delete(PageEntity, { id: page.id });
      }

      const attachments = await manager.find(PageAttachmentEntity, {
        where: {
          pageId: In(deletedPageIds),
        },
        select: {
          id: true,
          fileUrl: true,
        },
      });

      if (attachments.length > 0) {
        for (const attachment of attachments) {
          await this.fileService.deleteAttachment(attachment.fileUrl);
        }

        await manager.delete(PageAttachmentEntity, {
          id: In(attachments.map((attachment) => attachment.id)),
        });
      }

      await this.ensureDefaultPageAfterDeletion(
        manager.getRepository(ProjectEntity),
        page.projectId,
        deletedPageIds,
      );
    });
  }

  async uploadAttachment(
    userId: string,
    pageId: string,
    file: Express.Multer.File,
  ): Promise<PageAttachmentResponseDto> {
    const access = await this.resolveAccess(pageId, userId);
    this.assertCanEdit(access.role);

    if (!file) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_FILE_TYPE);
    }

    const uploaded = await this.fileService.uploadAttachment(file);

    const saved = await this.attachmentsRepository.save(
      this.attachmentsRepository.create({
        pageId,
        uploadedById: userId,
        originalName: uploaded.originalName,
        storageName: uploaded.storageName,
        fileUrl: uploaded.fileUrl,
        mimeType: uploaded.mimeType,
        fileSize: uploaded.fileSize,
      }),
    );

    return this.toAttachmentResponse(saved);
  }

  async listAttachments(
    userId: string,
    pageId: string,
  ): Promise<PageAttachmentResponseDto[]> {
    await this.resolveAccess(pageId, userId);

    const attachments = await this.attachmentsRepository.find({
      where: { pageId },
      order: { createdAt: 'ASC' },
    });

    return attachments.map((attachment) =>
      this.toAttachmentResponse(attachment),
    );
  }

  async deleteAttachment(
    userId: string,
    pageId: string,
    attachmentId: string,
  ): Promise<void> {
    const access = await this.resolveAccess(pageId, userId, {
      allowArchived: true,
    });
    this.assertCanEdit(access.role);

    const attachment = await this.attachmentsRepository.findOne({
      where: {
        id: attachmentId,
        pageId,
      },
    });

    if (!attachment) {
      throw new NotFoundException(ERROR_MESSAGES.ATTACHMENT_NOT_FOUND);
    }

    await this.fileService.deleteAttachment(attachment.fileUrl);
    await this.attachmentsRepository.delete({ id: attachment.id });
  }

  async getAttachmentDownload(
    userId: string,
    pageId: string,
    attachmentId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    await this.resolveAccess(pageId, userId);

    const attachment = await this.attachmentsRepository.findOne({
      where: {
        id: attachmentId,
        pageId,
      },
      select: {
        id: true,
        fileUrl: true,
        mimeType: true,
        originalName: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException(ERROR_MESSAGES.ATTACHMENT_NOT_FOUND);
    }

    const buffer = await this.fileService.readAttachmentForDownload(
      attachment.fileUrl,
    );

    return {
      buffer,
      mimeType: attachment.mimeType,
      fileName: attachment.originalName,
    };
  }

  private async resolveAccess(
    pageId: string,
    userId: string,
    options?: ResolvePageAccessOptions,
  ): Promise<PageAccess> {
    const page = await this.pagesRepository.findOne({ where: { id: pageId } });

    if (!page) {
      throw new NotFoundException(ERROR_MESSAGES.PAGE_NOT_FOUND);
    }

    if (!options?.allowArchived && page.isArchived) {
      throw new NotFoundException(ERROR_MESSAGES.PAGE_NOT_FOUND);
    }

    try {
      const project = await this.projectsService.getProject(
        userId,
        page.projectId,
      );
      return { page, role: project.role };
    } catch {
      throw new ForbiddenException(ERROR_MESSAGES.PAGE_ACCESS_DENIED);
    }
  }

  private assertCanEdit(role: ProjectRole): void {
    if (!PAGE_WRITE_ROLES.includes(role)) {
      throw new ForbiddenException(ERROR_MESSAGES.PAGE_INSUFFICIENT_ROLE);
    }
  }

  private async ensureParentInProject(
    projectId: string,
    parentPageId: string,
  ): Promise<void> {
    const parent = await this.pagesRepository.findOne({
      where: {
        id: parentPageId,
        projectId,
      },
    });

    if (!parent) {
      throw new NotFoundException(ERROR_MESSAGES.PAGE_PARENT_NOT_FOUND);
    }
  }

  private async assertNoParentCycle(
    pageId: string,
    nextParentId: string,
    projectId: string,
  ): Promise<void> {
    if (pageId === nextParentId) {
      throw new BadRequestException(ERROR_MESSAGES.PAGE_PARENT_CYCLE_DETECTED);
    }

    let cursorParentId: string | null = nextParentId;

    while (cursorParentId) {
      if (cursorParentId === pageId) {
        throw new BadRequestException(
          ERROR_MESSAGES.PAGE_PARENT_CYCLE_DETECTED,
        );
      }

      const cursor = await this.pagesRepository.findOne({
        where: {
          id: cursorParentId,
          projectId,
        },
        select: {
          id: true,
          parentPageId: true,
        },
      });

      if (!cursor) {
        throw new NotFoundException(ERROR_MESSAGES.PAGE_PARENT_NOT_FOUND);
      }

      cursorParentId = cursor.parentPageId;
    }
  }

  private getEmptyDocument(): Record<string, unknown> {
    return {
      type: 'doc',
      content: [],
    };
  }

  private getNumericMetaValue(
    meta: Record<string, unknown> | null | undefined,
    key: string,
  ): number | undefined {
    if (!meta || typeof meta !== 'object') {
      return undefined;
    }

    const value = meta[key];

    return typeof value === 'number' ? value : undefined;
  }

  private toResponse(
    page: PageEntity,
    role: ProjectRole,
    attachments: PageAttachmentResponseDto[],
  ): PageResponseDto {
    return {
      id: page.id,
      projectId: page.projectId,
      parentPageId: page.parentPageId,
      title: page.title,
      icon: page.icon,
      cover: page.cover,
      coverMeta: page.coverMeta,
      width: page.width,
      height: page.height,
      objectPositionX: page.objectPositionX,
      objectPositionY: page.objectPositionY,
      editorMeta: page.editorMeta,
      contentWidth: page.contentWidth,
      contentOffsetX: page.contentOffsetX,
      content: page.content,
      orderIndex: page.orderIndex,
      isArchived: page.isArchived,
      attachments,
      createdById: page.createdById,
      updatedById: page.updatedById,
      projectRole: role,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  private toTreeItemResponse(page: PageEntity): PageTreeItemResponseDto {
    return {
      id: page.id,
      parentPageId: page.parentPageId,
      title: page.title,
      icon: page.icon,
      orderIndex: page.orderIndex,
      isArchived: page.isArchived,
    };
  }

  private toAttachmentResponse(
    attachment: PageAttachmentEntity,
  ): PageAttachmentResponseDto {
    return {
      id: attachment.id,
      pageId: attachment.pageId,
      originalName: attachment.originalName,
      title: attachment.originalName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      fileUrl: attachment.fileUrl,
      fullUrl: this.fileService.getFullAttachmentUrl(attachment.fileUrl),
      uploadedById: attachment.uploadedById,
      createdAt: attachment.createdAt,
    };
  }

  private collectSubtreeIds(
    pages: Pick<PageEntity, 'id' | 'parentPageId'>[],
    rootId: string,
  ): string[] {
    const childrenByParentId = new Map<string, string[]>();

    for (const page of pages) {
      if (!page.parentPageId) {
        continue;
      }

      const ids = childrenByParentId.get(page.parentPageId) ?? [];
      ids.push(page.id);
      childrenByParentId.set(page.parentPageId, ids);
    }

    const result: string[] = [];
    const stack: string[] = [rootId];

    while (stack.length > 0) {
      const pageId = stack.pop();
      if (!pageId) {
        continue;
      }

      result.push(pageId);
      const children = childrenByParentId.get(pageId) ?? [];
      stack.push(...children);
    }

    return result;
  }

  private async ensureDefaultPageAfterDeletion(
    projectsRepository: Repository<ProjectEntity>,
    projectId: string,
    deletedPageIds: string[],
  ): Promise<void> {
    const project = await projectsRepository.findOne({
      where: { id: projectId },
      select: {
        id: true,
        defaultPageId: true,
      },
    });

    if (!project) {
      return;
    }

    const currentDefaultPageId = project.defaultPageId;

    if (
      currentDefaultPageId &&
      !deletedPageIds.includes(currentDefaultPageId)
    ) {
      return;
    }

    project.defaultPageId = null;
    await projectsRepository.save(project);
  }

  private async clearProjectDefaultPageIfMatches(
    projectId: string,
    pageId: string,
  ): Promise<void> {
    await this.pagesRepository.manager.update(
      ProjectEntity,
      {
        id: projectId,
        defaultPageId: pageId,
      },
      {
        defaultPageId: null,
      },
    );
  }
}
