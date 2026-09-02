import {
  TaskBoardColor,
  TaskBoardNodeName,
  TaskPriority,
} from '../enums/task-board.enums';

export const TASK_BOARD_COLORS = Object.values(TaskBoardColor);

export const TASK_PRIORITIES = Object.values(TaskPriority);

export const TASK_COLUMN_NAME_MIN_LENGTH = 1;
export const TASK_COLUMN_NAME_MAX_LENGTH = 80;

export const TASK_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_TASK_COLUMNS: ReadonlyArray<{
  name: string;
  color: TaskBoardColor;
}> = [
  { name: 'Not started', color: TaskBoardColor.Gray },
  { name: 'In progress', color: TaskBoardColor.Blue },
  { name: 'In testing', color: TaskBoardColor.Purple },
  { name: 'Done', color: TaskBoardColor.Green },
];

export function getEmptyTaskDescription(): Record<string, unknown> {
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };
}

export const ALLOWED_TIPTAP_NODE_TYPES = new Set<string>([
  'doc',
  'paragraph',
  'text',
  'heading',
  'blockquote',
  'codeBlock',
  'hardBreak',
  'horizontalRule',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'image',
  'linkChip',
  'callout',
  'file',
  'attachment',
  TaskBoardNodeName.TaskBoard,
]);
