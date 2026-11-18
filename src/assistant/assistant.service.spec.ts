import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SUBSCRIPTION_STATUS } from 'src/constants/stripe.constants';
import {
  ASSISTANT_CHAT_COMPLETIONS_URL,
  ASSISTANT_ROLE,
  GEMINI_FLASH_MODEL,
} from 'src/constants/assistant.constants';
import { ENV_VARIABLES } from 'src/constants/env.constants';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import { NotificationType } from 'src/notifications/enums/notification.enums';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PagesService } from 'src/pages/pages.service';
import { ProjectsService } from 'src/projects/projects.service';
import { UsersService } from 'src/users/users.service';
import { WorkspaceRole } from 'src/workspaces/enums/workspace.enums';
import { WorkspacesService } from 'src/workspaces/workspaces.service';
import { AssistantService } from './assistant.service';
import { pageDocument } from './assistant.utils';

function providerResponse(content: string) {
  return {
    ok: true,
    text: () =>
      Promise.resolve(JSON.stringify({ choices: [{ message: { content } }] })),
  };
}

describe('AssistantService', () => {
  const originalFetch = global.fetch;
  const apiKey = 'test-gemini-key';
  const userId = 'user-1';

  let service: AssistantService;
  let findById: jest.Mock;
  let findUserWorkspaces: jest.Mock;
  let createWorkspace: jest.Mock;
  let updateWorkspace: jest.Mock;
  let findMine: jest.Mock;
  let createProject: jest.Mock;
  let updateProject: jest.Mock;
  let getPage: jest.Mock;
  let listProjectPages: jest.Mock;
  let updatePage: jest.Mock;
  let listProjectsForAssistant: jest.Mock;
  let configGet: jest.Mock;

  beforeEach(async () => {
    findById = jest.fn();
    findUserWorkspaces = jest.fn();
    createWorkspace = jest.fn();
    updateWorkspace = jest.fn();
    findMine = jest.fn();
    createProject = jest.fn();
    updateProject = jest.fn();
    getPage = jest.fn();
    listProjectPages = jest.fn().mockResolvedValue([]);
    updatePage = jest.fn();
    listProjectsForAssistant = jest.fn().mockResolvedValue([]);
    configGet = jest.fn((key: string) => {
      if (key === ENV_VARIABLES.GEMINI_API_KEY) {
        return apiKey;
      }

      if (key === ENV_VARIABLES.GEMINI_MODEL) {
        return '';
      }

      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssistantService,
        { provide: UsersService, useValue: { findById } },
        {
          provide: WorkspacesService,
          useValue: {
            findUserWorkspaces,
            createWorkspace,
            updateWorkspace,
          },
        },
        { provide: NotificationsService, useValue: { findMine } },
        {
          provide: ProjectsService,
          useValue: {
            createProject,
            updateProject,
            listProjectsForAssistant,
          },
        },
        {
          provide: PagesService,
          useValue: { getPage, listProjectPages, updatePage },
        },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = module.get<AssistantService>(AssistantService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects an inactive subscription and does not call fetch', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.INACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    await expect(
      service.chat(userId, { message: 'Summarize my work' }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.chat(userId, { message: 'Summarize my work' }),
    ).rejects.toThrow(ERROR_MESSAGES.ASSISTANT_SUBSCRIPTION_REQUIRED);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing API key and does not call fetch', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    configGet.mockImplementation((key: string) => {
      if (key === ENV_VARIABLES.GEMINI_API_KEY) {
        return '   ';
      }

      return undefined;
    });
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    await expect(
      service.chat(userId, { message: 'Summarize my work' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.chat(userId, { message: 'Summarize my work' }),
    ).rejects.toThrow(ERROR_MESSAGES.ASSISTANT_NOT_CONFIGURED);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the reply for an active subscription and sends context', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    findUserWorkspaces.mockResolvedValue([
      { id: 'workspace-1', name: 'Design', role: WorkspaceRole.OWNER },
    ]);
    findMine.mockResolvedValue({
      notifications: [
        {
          type: NotificationType.TaskStatusChanged,
          isRead: false,
          payload: {
            actorUserId: 'actor-id-999',
            actorUsername: 'ada',
            actorAvatarUrl: 'https://avatar.example/a.png',
            workspaceId: 'workspace-id-999',
            workspaceName: 'Design',
            pageTitle: 'Notes',
            cardTitle: 'Write spec',
            columnName: 'Doing',
            previousColumnName: 'Todo',
          },
        },
      ],
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            choices: [{ message: { content: 'Here is a draft.' } }],
          }),
        ),
    });
    global.fetch = fetchMock;

    const result = await service.chat(userId, {
      message: 'Summarize my notifications',
      history: [{ role: ASSISTANT_ROLE.ASSISTANT, content: 'Earlier note' }],
    });

    expect(result).toEqual({ reply: 'Here is a draft.', changed: false });
    expect(JSON.stringify(result)).not.toContain(apiKey);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(typeof init.body).toBe('string');

    if (typeof init.body !== 'string') {
      throw new Error('expected a JSON string body');
    }

    const sent = JSON.parse(init.body) as {
      model: string;
      messages: { role: string; content: string }[];
    };
    const serialized = JSON.stringify(sent);

    expect(url).toBe(ASSISTANT_CHAT_COMPLETIONS_URL);
    expect(sent.model).toBe(GEMINI_FLASH_MODEL);
    expect(sent.messages[0]?.role).toBe(ASSISTANT_ROLE.SYSTEM);
    expect(sent.messages[0]?.content).toContain('igor');
    expect(sent.messages[0]?.content).toContain('Design');
    expect(sent.messages[0]?.content).toContain('Notes');
    expect(sent.messages.at(-1)).toEqual({
      role: ASSISTANT_ROLE.USER,
      content: 'Summarize my notifications',
    });
    expect(serialized).not.toContain('https://avatar.example/a.png');
    expect(serialized).not.toContain('actor-id-999');
    expect(serialized).not.toContain(apiKey);
  });

  it('sends editable text, table data, and task status identifiers as context', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    findUserWorkspaces.mockResolvedValue([
      { id: 'workspace-1', name: 'Design', role: WorkspaceRole.OWNER },
    ]);
    findMine.mockResolvedValue({ notifications: [] });
    listProjectsForAssistant.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Analytics',
        visibility: 'WORKSPACE',
        role: 'OWNER',
      },
    ]);
    listProjectPages.mockResolvedValue([{ id: 'page-1', title: 'Dashboard' }]);
    getPage.mockResolvedValue({
      id: 'page-1',
      title: 'Dashboard',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            content: [{ type: 'text', text: 'Monthly report' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Metric' }],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Value' }],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Revenue' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '$120,000' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'taskBoard',
            attrs: {
              boardId: 'board-1',
              columns: [{ id: 'done', name: 'Done' }],
              cards: [
                {
                  id: 'card-1',
                  title: 'Update dashboard',
                  columnId: 'done',
                },
              ],
            },
          },
        ],
      },
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValue(providerResponse('Here you go.'));
    global.fetch = fetchMock;

    await service.chat(userId, { message: 'What is on my dashboard?' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    if (typeof init.body !== 'string') {
      throw new Error('expected a JSON string body');
    }

    const requestBody = JSON.parse(init.body) as {
      messages: Array<{ content: string }>;
    };

    expect(requestBody.messages[0]?.content).toContain('page-1');
    expect(requestBody.messages[0]?.content).toContain('Monthly report');
    expect(requestBody.messages[0]?.content).toContain(
      '"headers":["Metric","Value"]',
    );
    expect(requestBody.messages[0]?.content).toContain('$120,000');
    expect(requestBody.messages[0]?.content).toContain(
      'text nodes ["Monthly report"]',
    );
    expect(requestBody.messages[0]?.content).toContain('board-1');
    expect(requestBody.messages[0]?.content).toContain('card-1');
    expect(requestBody.messages[0]?.content).toContain('Update dashboard');
    expect(requestBody.messages[0]?.content).toContain('Done');
  });

  it('applies table actions through the permission-checked page service', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    findUserWorkspaces.mockResolvedValue([]);
    findMine.mockResolvedValue({ notifications: [] });
    getPage.mockResolvedValue({
      id: 'page-1',
      title: 'Analytics',
      content: pageDocument([
        {
          type: 'table',
          headers: ['Metric', 'Value'],
          rows: [['Revenue', '$120,000']],
        },
      ]),
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        providerResponse(
          'Adding a row.\n```assistant-action\n{"type":"appendTableRow","pageId":"page-1","tableIndex":1,"headers":["Metric","Value"],"values":["Users","4,200"]}\n```',
        ),
      )
      .mockResolvedValueOnce(
        providerResponse(
          'Adding a column.\n```assistant-action\n{"type":"addTableColumn","pageId":"page-1","tableIndex":1,"headers":["Metric","Value"],"header":"Change","values":["+8%"]}\n```',
        ),
      );

    await service.chat(userId, { message: 'Add a row' });
    const result = await service.chat(userId, { message: 'Add a column' });

    expect(updatePage).toHaveBeenNthCalledWith(1, userId, 'page-1', {
      content: pageDocument([
        {
          type: 'table',
          headers: ['Metric', 'Value'],
          rows: [
            ['Revenue', '$120,000'],
            ['Users', '4,200'],
          ],
        },
      ]),
    });
    expect(updatePage).toHaveBeenNthCalledWith(2, userId, 'page-1', {
      content: pageDocument([
        {
          type: 'table',
          headers: ['Metric', 'Value', 'Change'],
          rows: [['Revenue', '$120,000', '+8%']],
        },
      ]),
    });
    expect(result.changed).toBe(true);
  });

  it('adds text after an existing heading when the user accepts an offer', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    findUserWorkspaces.mockResolvedValue([]);
    findMine.mockResolvedValue({ notifications: [] });
    const content = pageDocument([
      { type: 'heading', text: 'Key metrics' },
      { type: 'paragraph', text: 'Existing details' },
    ]);
    getPage.mockResolvedValue({
      id: 'page-1',
      title: 'Analytics',
      content,
    });
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        providerResponse(
          'I will add the metrics.\n```assistant-action\n{"type":"insertPageBlocks","pageId":"page-1","afterText":"Key metrics","blocks":[{"type":"bulletList","items":["Retention: 92%"]}]}\n```',
        ),
      );

    const result = await service.chat(userId, {
      message: 'Yes, add them',
    });
    const originalBlocks = Array.isArray(content.content)
      ? content.content
      : [];

    expect(updatePage).toHaveBeenCalledWith(userId, 'page-1', {
      content: {
        type: 'doc',
        content: [
          originalBlocks[0],
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Retention: 92%' }],
                  },
                ],
              },
            ],
          },
          originalBlocks[1],
        ],
      },
    });
    expect(result.changed).toBe(true);
  });

  it('rejects a non-OK provider response with a client-safe error', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    findUserWorkspaces.mockResolvedValue([]);
    findMine.mockResolvedValue({ notifications: [] });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: () =>
        Promise.resolve(
          JSON.stringify({ error: `${apiKey} raw provider body` }),
        ),
    });

    try {
      await service.chat(userId, { message: 'Summarize my work' });
      throw new Error('expected the provider error to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);

      if (!(error instanceof BadRequestException)) {
        throw error;
      }

      const serialized = JSON.stringify(error.getResponse());

      expect(error.message).toBe(ERROR_MESSAGES.ASSISTANT_UNAVAILABLE);
      expect(serialized).toContain(ERROR_MESSAGES.ASSISTANT_UNAVAILABLE);
      expect(serialized).not.toContain(apiKey);
      expect(serialized).not.toContain('raw provider body');
    }
  });

  it('creates a workspace-visible project and page from an action', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    findUserWorkspaces.mockResolvedValue([
      { id: 'workspace-1', name: 'Design', role: WorkspaceRole.OWNER },
    ]);
    findMine.mockResolvedValue({ notifications: [] });
    createProject.mockResolvedValue({
      id: 'project-1',
      name: 'Test',
      defaultPageId: 'page-root',
    });
    updatePage.mockResolvedValue({ id: 'page-root', title: 'Assistant' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    'Done, I created the project and page.\n```assistant-action\n{"workspaceId":"workspace-1","projectName":"Test","visibility":"WORKSPACE","pageTitle":"Assistant","icon":"📊","blocks":[{"type":"heading","level":1,"text":"Analytics"},{"type":"paragraph","text":"Revenue","marks":["bold","italic"],"color":"#2563eb","highlightColor":"#fde68a"},{"type":"table","headers":["Metric","Value"],"rows":[["Revenue","100"]]},{"type":"taskBoard","columns":["Planned","Done"],"cards":[{"title":"Prepare report","column":"Planned"}]}]}\n```',
                },
              },
            ],
          }),
        ),
    });

    const result = await service.chat(userId, {
      message: 'Create a project named Test',
    });

    expect(createProject).toHaveBeenCalledWith(userId, 'workspace-1', {
      name: 'Test',
      visibility: 'WORKSPACE',
    });
    expect(updatePage).toHaveBeenCalledWith(userId, 'page-root', {
      title: 'Assistant',
      icon: '📊',
      content: pageDocument([
        { type: 'heading', level: 1, text: 'Analytics' },
        {
          type: 'paragraph',
          text: 'Revenue',
          marks: ['bold', 'italic'],
          color: '#2563eb',
          highlightColor: '#fde68a',
        },
        {
          type: 'table',
          headers: ['Metric', 'Value'],
          rows: [['Revenue', '100']],
        },
        {
          type: 'taskBoard',
          columns: ['Planned', 'Done'],
          cards: [{ title: 'Prepare report', column: 'Planned' }],
        },
      ]),
    });
    expect(result.changed).toBe(true);
    expect(result.reply).toBe('Done, I created the project and page.');
    expect(result.reply).not.toContain('Created project');
    expect(result.reply).not.toContain('assistant-action');
  });

  it('creates a workspace for a user with no existing workspaces', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    findUserWorkspaces.mockResolvedValue([]);
    findMine.mockResolvedValue({ notifications: [] });
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        providerResponse(
          'I will create the workspace.\n```assistant-action\n{"type":"createWorkspace","name":"Test"}\n```',
        ),
      );

    const result = await service.chat(userId, {
      message: 'Create Test',
    });

    expect(createWorkspace).toHaveBeenCalledWith(userId, { name: 'Test' });
    expect(result.changed).toBe(true);
  });

  it('requires an explicit workspace when more than one is available', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    findUserWorkspaces.mockResolvedValue([
      { id: 'workspace-1', name: 'Design', role: WorkspaceRole.OWNER },
      { id: 'workspace-2', name: 'Research', role: WorkspaceRole.OWNER },
    ]);
    findMine.mockResolvedValue({ notifications: [] });
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        providerResponse(
          'I will create a project.\n```assistant-action\n{"type":"createProject","projectName":"Test","pageTitle":"Test","blocks":[{"type":"paragraph","text":"Hello"}]}\n```',
        ),
      );

    await expect(
      service.chat(userId, { message: 'Create a project' }),
    ).rejects.toThrow(ERROR_MESSAGES.ASSISTANT_WORKSPACE_SELECTION_REQUIRED);

    expect(createProject).not.toHaveBeenCalled();
  });

  it('routes rename actions through existing role-checked services', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    findUserWorkspaces.mockResolvedValue([]);
    findMine.mockResolvedValue({ notifications: [] });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        providerResponse(
          'I will rename it.\n```assistant-action\n{"type":"renameWorkspace","workspaceId":"workspace-1","name":"New workspace"}\n```',
        ),
      )
      .mockResolvedValueOnce(
        providerResponse(
          'I will rename it.\n```assistant-action\n{"type":"renameProject","projectId":"project-1","name":"New project"}\n```',
        ),
      )
      .mockResolvedValueOnce(
        providerResponse(
          'I will rename it.\n```assistant-action\n{"type":"renamePage","pageId":"page-1","title":"New page"}\n```',
        ),
      );

    await service.chat(userId, { message: 'Rename workspace' });
    await service.chat(userId, { message: 'Rename project' });
    const result = await service.chat(userId, { message: 'Rename page' });

    expect(updateWorkspace).toHaveBeenCalledWith('workspace-1', userId, {
      name: 'New workspace',
    });
    expect(updateProject).toHaveBeenCalledWith(userId, 'project-1', {
      name: 'New project',
    });
    expect(updatePage).toHaveBeenCalledWith(userId, 'page-1', {
      title: 'New page',
    });
    expect(result.changed).toBe(true);
  });

  it('replaces exact page text and moves a task card between statuses', async () => {
    findById.mockResolvedValue({
      id: userId,
      username: 'igor',
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionCurrentPeriodEnd: null,
    });
    findUserWorkspaces.mockResolvedValue([]);
    findMine.mockResolvedValue({ notifications: [] });
    const headingNode = {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Old heading' }],
    };
    const taskBoardNode = {
      type: 'taskBoard',
      attrs: {
        boardId: 'board-1',
        columns: [
          { id: 'todo', name: 'To do', color: 'gray', order: 0 },
          { id: 'done', name: 'Done', color: 'green', order: 1 },
        ],
        cards: [
          {
            id: 'card-1',
            columnId: 'todo',
            title: 'Update dashboard',
            order: 0,
          },
        ],
      },
    };
    const originalContent = {
      type: 'doc',
      content: [headingNode, taskBoardNode],
    };
    getPage.mockResolvedValue({
      id: 'page-1',
      title: 'Analytics',
      content: originalContent,
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        providerResponse(
          'I will update the heading.\n```assistant-action\n{"type":"replacePageText","pageId":"page-1","findText":"Old heading","replaceText":"New heading"}\n```',
        ),
      )
      .mockResolvedValueOnce(
        providerResponse(
          'I will move the task.\n```assistant-action\n{"type":"moveTask","pageId":"page-1","boardId":"board-1","cardId":"card-1","targetColumn":"Done"}\n```',
        ),
      );

    await service.chat(userId, { message: 'Change the heading' });
    const result = await service.chat(userId, { message: 'Move the task' });

    expect(updatePage).toHaveBeenNthCalledWith(1, userId, 'page-1', {
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'New heading' }],
          },
          taskBoardNode,
        ],
      },
    });
    expect(updatePage).toHaveBeenNthCalledWith(2, userId, 'page-1', {
      content: {
        ...originalContent,
        content: [
          headingNode,
          {
            ...taskBoardNode,
            attrs: {
              ...taskBoardNode.attrs,
              cards: [
                {
                  ...taskBoardNode.attrs.cards[0],
                  columnId: 'done',
                  order: 0,
                },
              ],
            },
          },
        ],
      },
    });
    expect(result.changed).toBe(true);
  });
});
