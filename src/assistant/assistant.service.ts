import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isSubscriptionActive } from 'src/billing/subscription.util';
import {
  ASSISTANT_CHAT_COMPLETIONS_URL,
  ASSISTANT_HTTP,
  ASSISTANT_LIMITS,
  ASSISTANT_PROVIDER_FIELDS,
  ASSISTANT_ROLE,
  ASSISTANT_SYSTEM_PROMPT,
  GEMINI_FLASH_MODEL,
} from 'src/constants/assistant.constants';
import { ENV_VARIABLES } from 'src/constants/env.constants';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import { NotificationsService } from 'src/notifications/notifications.service';
import type { NotificationResponseDto } from 'src/notifications/dto/notification-response.dto';
import { PagesService } from 'src/pages/pages.service';
import { ProjectsService } from 'src/projects/projects.service';
import type {
  AssistantAction,
  AssistantBoardCard,
  AssistantBoardColumn,
  AssistantChatInput,
  AssistantChatReply,
  AssistantContextNotification,
  AssistantContextPage,
  AssistantContextProject,
  AssistantContextWorkspace,
  AssistantContextTaskBoard,
  AssistantPromptContext,
  AssistantProviderMessage,
  CreateProjectPageAction,
} from 'src/types/assistant.type';
import { UsersService } from 'src/users/users.service';
import { WorkspacesService } from 'src/workspaces/workspaces.service';
import {
  addTableColumn,
  appendTableRow,
  extractPageTables,
  extractAssistantAction,
  insertPageBlocksAfterText,
  moveTaskCard,
  pageDocument,
  replacePageText,
} from './assistant.utils';

@Injectable()
export class AssistantService {
  constructor(
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    private readonly notificationsService: NotificationsService,
    private readonly projectsService: ProjectsService,
    private readonly pagesService: PagesService,
    private readonly configService: ConfigService,
  ) {}

  async chat(
    userId: string,
    input: AssistantChatInput,
  ): Promise<AssistantChatReply> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (!isSubscriptionActive(user)) {
      throw new ForbiddenException(
        ERROR_MESSAGES.ASSISTANT_SUBSCRIPTION_REQUIRED,
      );
    }

    const apiKey = this.readConfig(ENV_VARIABLES.GEMINI_API_KEY);

    if (!apiKey) {
      throw new BadRequestException(ERROR_MESSAGES.ASSISTANT_NOT_CONFIGURED);
    }

    const model =
      this.readConfig(ENV_VARIABLES.GEMINI_MODEL) || GEMINI_FLASH_MODEL;
    const workspaces = await this.workspacesService.findUserWorkspaces(user.id);
    const context = await this.loadContext(user.id, user.username, workspaces);
    const reply = await this.requestReply(
      apiKey,
      model,
      this.buildMessages(input, context),
    );
    const extracted = extractAssistantAction(reply);

    if (!extracted.action) {
      return { reply: extracted.text, changed: false };
    }

    const changed = await this.executeAction(
      userId,
      workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        role: workspace.role,
      })),
      extracted.action,
    );

    return {
      reply: extracted.text || 'Done.',
      changed,
    };
  }

  private readConfig(name: string): string {
    const value = this.configService.get<string>(name);

    return typeof value === 'string' ? value.trim() : '';
  }

  private async loadContext(
    userId: string,
    username: string,
    workspaces: Array<{ id: string; name: string; role: string }>,
  ): Promise<string> {
    const notificationList = await this.notificationsService.findMine(userId, {
      page: ASSISTANT_LIMITS.NOTIFICATIONS_PAGE,
      limit: ASSISTANT_LIMITS.NOTIFICATIONS_LIMIT,
    });
    const projectGroups = await Promise.all(
      workspaces.map((workspace) =>
        this.projectsService.listProjectsForAssistant(userId, workspace.id),
      ),
    );
    const projects = projectGroups
      .flat()
      .slice(0, ASSISTANT_LIMITS.PROJECTS_MAX_ITEMS);
    const projectsWithPages = await this.loadProjectPages(userId, projects);

    return this.buildContext({
      username,
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        role: workspace.role,
      })),
      projects: projectsWithPages,
      notifications: notificationList.notifications.map((notification) =>
        this.toContextNotification(notification),
      ),
    });
  }

  private toContextNotification(
    notification: NotificationResponseDto,
  ): AssistantContextNotification {
    return {
      type: notification.type,
      workspaceName: notification.payload.workspaceName,
      actorUsername: notification.payload.actorUsername,
      pageTitle: notification.payload.pageTitle,
      cardTitle: notification.payload.cardTitle,
      columnName: notification.payload.columnName,
      previousColumnName: notification.payload.previousColumnName,
      isRead: notification.isRead,
    };
  }

  private buildContext(context: AssistantPromptContext): string {
    const workspaceLines = context.workspaces.map(
      (workspace) => `${workspace.id} ${workspace.name} (${workspace.role})`,
    );
    const notificationLines = context.notifications.map((notification) =>
      JSON.stringify(notification),
    );
    const projectLines = context.projects.map((project) => {
      const pages = project.pages.map((page) => {
        const boards = page.taskBoards.map((board) => ({
          id: board.id,
          columns: board.columns,
          cards: board.cards,
        }));

        return [
          `page ${page.id} "${page.title}"`,
          `text nodes ${JSON.stringify(page.textNodes)}`,
          `tables ${JSON.stringify(page.tables)}`,
          `boards ${JSON.stringify(boards)}`,
        ].join('; ');
      });

      return [
        `${project.id} ${project.name} (${project.visibility}, ${project.role})`,
        ...pages,
      ].join('\n');
    });
    const text = [
      `Username: ${context.username}`,
      'Workspaces the user belongs to:',
      ...workspaceLines,
      'Projects the user can see. Private projects they were not added to are omitted:',
      ...projectLines,
      'Notifications that belong only to this user:',
      ...notificationLines,
    ].join('\n');

    return text.slice(0, ASSISTANT_LIMITS.CONTEXT_MAX_CHARS);
  }

  private async loadProjectPages(
    userId: string,
    projects: Array<Omit<AssistantContextProject, 'pages'>>,
  ): Promise<AssistantContextProject[]> {
    let remainingPages = ASSISTANT_LIMITS.PAGES_MAX_ITEMS;
    const result: AssistantContextProject[] = [];

    for (const project of projects) {
      const pageItems =
        remainingPages > 0
          ? await this.pagesService.listProjectPages(userId, project.id)
          : [];
      const selectedPages = pageItems.slice(0, remainingPages);
      remainingPages -= selectedPages.length;
      const pages: AssistantContextPage[] = await Promise.all(
        selectedPages.map(async (pageItem) => {
          const page = await this.pagesService.getPage(userId, pageItem.id);

          return {
            id: page.id,
            title: page.title,
            textNodes: this.extractPageTextNodes(page.content),
            tables: extractPageTables(page.content),
            taskBoards: this.extractTaskBoards(page.content),
          };
        }),
      );

      result.push({ ...project, pages });
    }

    return result;
  }

  private extractPageTextNodes(content: Record<string, unknown>): string[] {
    const textNodes: string[] = [];
    let remainingChars = ASSISTANT_LIMITS.PAGE_TEXT_MAX_CHARS;
    const visit = (value: unknown) => {
      if (!this.isRecord(value)) {
        return;
      }

      if (value.type === 'table' || remainingChars <= 0) {
        return;
      }

      if (value.type === 'text' && typeof value.text === 'string') {
        const text = value.text.slice(0, remainingChars);

        if (
          text &&
          textNodes.length < ASSISTANT_LIMITS.PAGE_TEXT_NODES_MAX_ITEMS
        ) {
          textNodes.push(text);
          remainingChars -= text.length;
        }
      }

      if (Array.isArray(value.content)) {
        value.content.forEach(visit);
      }
    };

    visit(content);
    return textNodes;
  }

  private extractTaskBoards(
    content: Record<string, unknown>,
  ): AssistantContextTaskBoard[] {
    const boards: AssistantContextTaskBoard[] = [];
    const visit = (value: unknown) => {
      if (!this.isRecord(value)) {
        return;
      }

      if (
        value.type === 'taskBoard' &&
        this.isRecord(value.attrs) &&
        typeof value.attrs.boardId === 'string'
      ) {
        const columns = Array.isArray(value.attrs.columns)
          ? value.attrs.columns.filter(
              (
                column,
              ): column is Record<string, unknown> & AssistantBoardColumn =>
                this.isRecord(column) &&
                typeof column.id === 'string' &&
                typeof column.name === 'string',
            )
          : [];
        const columnNameById = new Map<string, string>(
          columns.map((column) => [column.id, column.name]),
        );
        const cards = Array.isArray(value.attrs.cards)
          ? value.attrs.cards
              .filter(
                (card): card is Record<string, unknown> & AssistantBoardCard =>
                  this.isRecord(card) &&
                  typeof card.id === 'string' &&
                  typeof card.title === 'string' &&
                  typeof card.columnId === 'string',
              )
              .slice(0, ASSISTANT_LIMITS.TASK_CARDS_MAX_ITEMS)
              .map((card) => ({
                id: card.id,
                title: card.title,
                columnId: card.columnId,
                status: columnNameById.get(card.columnId) ?? 'Unknown',
              }))
          : [];

        boards.push({
          id: value.attrs.boardId,
          columns: columns
            .slice(0, 8)
            .map((column) => ({ id: column.id, name: column.name })),
          cards,
        });
      }

      if (Array.isArray(value.content)) {
        value.content.forEach(visit);
      }
    };

    visit(content);
    return boards.slice(0, ASSISTANT_LIMITS.TASK_BOARDS_MAX_ITEMS);
  }

  private async executeAction(
    userId: string,
    workspaces: AssistantContextWorkspace[],
    action: AssistantAction,
  ): Promise<boolean> {
    switch (action.type) {
      case 'createWorkspace':
        await this.workspacesService.createWorkspace(userId, {
          name: action.name,
        });
        return true;
      case 'createProject':
        await this.createProjectPage(userId, workspaces, action);
        return true;
      case 'renameWorkspace':
        await this.workspacesService.updateWorkspace(
          action.workspaceId,
          userId,
          { name: action.name },
        );
        return true;
      case 'renameProject':
        await this.projectsService.updateProject(userId, action.projectId, {
          name: action.name,
        });
        return true;
      case 'renamePage':
        await this.pagesService.updatePage(userId, action.pageId, {
          title: action.title,
        });
        return true;
      case 'replacePageText': {
        const page = await this.pagesService.getPage(userId, action.pageId);
        const result = replacePageText(
          page.content,
          action.findText,
          action.replaceText,
        );

        if (result.matches !== 1) {
          throw new BadRequestException(
            result.matches === 0
              ? ERROR_MESSAGES.ASSISTANT_ACTION_TARGET_NOT_FOUND
              : ERROR_MESSAGES.ASSISTANT_ACTION_TARGET_AMBIGUOUS,
          );
        }

        if (action.findText === action.replaceText) {
          return false;
        }

        await this.pagesService.updatePage(userId, action.pageId, {
          content: result.content,
        });
        return true;
      }
      case 'insertPageBlocks': {
        const page = await this.pagesService.getPage(userId, action.pageId);
        const result = insertPageBlocksAfterText(
          page.content,
          action.afterText,
          action.blocks,
        );

        if (result.matches !== 1) {
          throw new BadRequestException(
            result.matches === 0
              ? ERROR_MESSAGES.ASSISTANT_ACTION_TARGET_NOT_FOUND
              : ERROR_MESSAGES.ASSISTANT_ACTION_TARGET_AMBIGUOUS,
          );
        }

        if (!result.changed) {
          return false;
        }

        await this.pagesService.updatePage(userId, action.pageId, {
          content: result.content,
        });
        return true;
      }
      case 'appendTableRow':
      case 'addTableColumn': {
        const page = await this.pagesService.getPage(userId, action.pageId);
        const result =
          action.type === 'appendTableRow'
            ? appendTableRow(
                page.content,
                action.tableIndex,
                action.headers,
                action.values,
              )
            : addTableColumn(
                page.content,
                action.tableIndex,
                action.headers,
                action.header,
                action.values,
              );

        if (result.matches !== 1) {
          throw new BadRequestException(
            ERROR_MESSAGES.ASSISTANT_ACTION_TARGET_NOT_FOUND,
          );
        }

        if (result.shapeMismatch) {
          throw new BadRequestException(
            ERROR_MESSAGES.ASSISTANT_TABLE_SHAPE_MISMATCH,
          );
        }

        if (!result.changed) {
          return false;
        }

        await this.pagesService.updatePage(userId, action.pageId, {
          content: result.content,
        });
        return true;
      }
      case 'moveTask': {
        const page = await this.pagesService.getPage(userId, action.pageId);
        const result = moveTaskCard(
          page.content,
          action.boardId,
          action.cardId,
          action.targetColumn,
        );

        if (result.matches !== 1) {
          throw new BadRequestException(
            ERROR_MESSAGES.ASSISTANT_ACTION_TARGET_NOT_FOUND,
          );
        }

        if (!result.changed) {
          return false;
        }

        await this.pagesService.updatePage(userId, action.pageId, {
          content: result.content,
        });
        return true;
      }
    }
  }

  private async createProjectPage(
    userId: string,
    workspaces: AssistantContextWorkspace[],
    action: CreateProjectPageAction,
  ): Promise<{ projectName: string; pageTitle: string }> {
    const workspace = action.workspaceId
      ? workspaces.find((item) => item.id === action.workspaceId)
      : workspaces.length === 1
        ? workspaces[0]
        : undefined;

    if (!workspace) {
      throw new BadRequestException(
        action.workspaceId
          ? ERROR_MESSAGES.ASSISTANT_ACTION_TARGET_NOT_FOUND
          : workspaces.length > 1
            ? ERROR_MESSAGES.ASSISTANT_WORKSPACE_SELECTION_REQUIRED
            : 'There is no workspace where a project can be created.',
      );
    }

    const project = await this.projectsService.createProject(
      userId,
      workspace.id,
      {
        name: action.projectName,
        ...(action.visibility ? { visibility: action.visibility } : {}),
      },
    );

    if (!project.defaultPageId) {
      throw new BadRequestException(ERROR_MESSAGES.ASSISTANT_UNAVAILABLE);
    }

    const page = await this.pagesService.updatePage(
      userId,
      project.defaultPageId,
      {
        title: action.pageTitle,
        ...(action.icon ? { icon: action.icon } : {}),
        content: pageDocument(action.blocks),
      },
    );

    return { projectName: project.name, pageTitle: page.title };
  }

  private buildMessages(
    input: AssistantChatInput,
    context: string,
  ): AssistantProviderMessage[] {
    const history = (input.history ?? []).slice(
      0,
      ASSISTANT_LIMITS.HISTORY_MAX_ITEMS,
    );

    return [
      {
        role: ASSISTANT_ROLE.SYSTEM,
        content: `${ASSISTANT_SYSTEM_PROMPT}\n\n${context}`,
      },
      ...history.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      {
        role: ASSISTANT_ROLE.USER,
        content: input.message,
      },
    ];
  }

  private async requestReply(
    apiKey: string,
    model: string,
    messages: AssistantProviderMessage[],
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      ASSISTANT_LIMITS.REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(ASSISTANT_CHAT_COMPLETIONS_URL, {
        method: ASSISTANT_HTTP.METHOD,
        headers: {
          [ASSISTANT_HTTP.AUTHORIZATION_HEADER]: `${ASSISTANT_HTTP.AUTH_SCHEME} ${apiKey}`,
          [ASSISTANT_HTTP.CONTENT_TYPE_HEADER]:
            ASSISTANT_HTTP.CONTENT_TYPE_JSON,
        },
        body: JSON.stringify({
          [ASSISTANT_PROVIDER_FIELDS.MODEL]: model,
          [ASSISTANT_PROVIDER_FIELDS.MESSAGES]: messages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BadRequestException(ERROR_MESSAGES.ASSISTANT_UNAVAILABLE);
      }

      return this.readReply(await this.readProviderBody(response));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(ERROR_MESSAGES.ASSISTANT_UNAVAILABLE);
    } finally {
      clearTimeout(timer);
    }
  }

  private async readProviderBody(response: Response): Promise<unknown> {
    const text = await response.text();

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new BadRequestException(ERROR_MESSAGES.ASSISTANT_UNAVAILABLE);
    }
  }

  private readReply(payload: unknown): string {
    const content = this.readChoiceContent(payload);

    if (content.trim().length === 0) {
      throw new BadRequestException(ERROR_MESSAGES.ASSISTANT_UNAVAILABLE);
    }

    return content;
  }

  private readChoiceContent(payload: unknown): string {
    if (!this.isRecord(payload)) {
      throw new BadRequestException(ERROR_MESSAGES.ASSISTANT_UNAVAILABLE);
    }

    const choices = payload[ASSISTANT_PROVIDER_FIELDS.CHOICES];

    if (!Array.isArray(choices)) {
      throw new BadRequestException(ERROR_MESSAGES.ASSISTANT_UNAVAILABLE);
    }

    const first: unknown = choices[0];

    if (!this.isRecord(first)) {
      throw new BadRequestException(ERROR_MESSAGES.ASSISTANT_UNAVAILABLE);
    }

    const message = first[ASSISTANT_PROVIDER_FIELDS.MESSAGE];

    const content = this.isRecord(message)
      ? message[ASSISTANT_PROVIDER_FIELDS.CONTENT]
      : undefined;

    if (typeof content !== 'string') {
      throw new BadRequestException(ERROR_MESSAGES.ASSISTANT_UNAVAILABLE);
    }

    return content;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
