import { ASSISTANT_ROLE } from 'src/constants/assistant.constants';
import { ProjectVisibility } from 'src/projects/enums/project.enums';

export interface AssistantContentBlock {
  type: string;
  text?: string;
  level?: number;
  marks?: string[];
  color?: string;
  highlightColor?: string;
  items?: string[];
  headers?: string[];
  rows?: string[][];
  columns?: string[];
  cards?: AssistantTaskBoardCardBlock[];
}

export interface AssistantTaskBoardCardBlock {
  title?: string;
  column?: string;
}

export interface CreateProjectPageAction {
  type: 'createProject';
  workspaceId?: string;
  projectName: string;
  visibility?: ProjectVisibility;
  pageTitle: string;
  icon?: string;
  blocks: AssistantContentBlock[];
}

export interface CreateWorkspaceAction {
  type: 'createWorkspace';
  name: string;
}

export interface RenameWorkspaceAction {
  type: 'renameWorkspace';
  workspaceId: string;
  name: string;
}

export interface RenameProjectAction {
  type: 'renameProject';
  projectId: string;
  name: string;
}

export interface RenamePageAction {
  type: 'renamePage';
  pageId: string;
  title: string;
}

export interface ReplacePageTextAction {
  type: 'replacePageText';
  pageId: string;
  findText: string;
  replaceText: string;
}

export interface MoveTaskAction {
  type: 'moveTask';
  pageId: string;
  boardId: string;
  cardId: string;
  targetColumn: string;
}

export interface InsertPageBlocksAction {
  type: 'insertPageBlocks';
  pageId: string;
  afterText: string;
  blocks: AssistantContentBlock[];
}

export interface AppendTableRowAction {
  type: 'appendTableRow';
  pageId: string;
  tableIndex: number;
  headers: string[];
  values: string[];
}

export interface AddTableColumnAction {
  type: 'addTableColumn';
  pageId: string;
  tableIndex: number;
  headers: string[];
  header: string;
  values?: string[];
}

export type AssistantAction =
  | CreateProjectPageAction
  | CreateWorkspaceAction
  | RenameWorkspaceAction
  | RenameProjectAction
  | RenamePageAction
  | ReplacePageTextAction
  | MoveTaskAction
  | InsertPageBlocksAction
  | AppendTableRowAction
  | AddTableColumnAction;

export interface ExtractedAssistantAction {
  text: string;
  action: AssistantAction | null;
}

export interface AssistantPageTableMutation {
  content: Record<string, unknown>;
  matches: number;
  changed: boolean;
  shapeMismatch: boolean;
}

export interface AssistantTextMatchResult {
  content: Record<string, unknown>;
  matches: number;
}

export interface AssistantTaskMoveResult extends AssistantTextMatchResult {
  changed: boolean;
}

export interface AssistantPageBlockInsertionResult extends AssistantTextMatchResult {
  changed: boolean;
}

export interface AssistantBoardColumn {
  id: string;
  name: string;
}

export interface AssistantBoardCard {
  id: string;
  title: string;
  columnId: string;
}

export interface AssistantHistoryItem {
  role: typeof ASSISTANT_ROLE.USER | typeof ASSISTANT_ROLE.ASSISTANT;
  content: string;
}

export interface AssistantChatInput {
  message: string;
  history?: AssistantHistoryItem[];
}

export interface AssistantChatReply {
  reply: string;
  changed: boolean;
}

export interface AssistantContextWorkspace {
  id: string;
  name: string;
  role: string;
}

export interface AssistantContextNotification {
  type: string;
  workspaceName: string;
  actorUsername: string;
  pageTitle?: string;
  cardTitle?: string;
  columnName?: string;
  previousColumnName?: string;
  isRead: boolean;
}

export interface AssistantContextProject {
  id: string;
  name: string;
  visibility: string;
  role: string;
  pages: AssistantContextPage[];
}

export interface AssistantContextPage {
  id: string;
  title: string;
  textNodes: string[];
  tables: AssistantContextTable[];
  taskBoards: AssistantContextTaskBoard[];
}

export interface AssistantContextTable {
  index: number;
  headers: string[];
  rows: string[][];
  rowCount: number;
  rowsTruncated: boolean;
  columnsTruncated: boolean;
  cellsTruncated: boolean;
}

export interface AssistantContextTaskBoard {
  id: string;
  columns: Array<{ id: string; name: string }>;
  cards: Array<{ id: string; title: string; columnId: string; status: string }>;
}

export interface AssistantPromptContext {
  username: string;
  workspaces: AssistantContextWorkspace[];
  projects: AssistantContextProject[];
  notifications: AssistantContextNotification[];
}

export interface AssistantProviderMessage {
  role: string;
  content: string;
}
