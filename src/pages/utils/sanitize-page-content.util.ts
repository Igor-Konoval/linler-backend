import { BadRequestException } from '@nestjs/common';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import {
  ALLOWED_TIPTAP_NODE_TYPES,
  getEmptyTaskDescription,
  TASK_BOARD_COLORS,
  TASK_COLUMN_NAME_MAX_LENGTH,
  TASK_COLUMN_NAME_MIN_LENGTH,
  TASK_DATE_PATTERN,
  TASK_PRIORITIES,
} from '../constants/task-board.constants';
import {
  TaskBoardColor,
  TaskBoardNodeName,
  TaskPriority,
} from '../enums/task-board.enums';

interface SanitizeContext {
  assignableUserIds: ReadonlySet<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTaskBoardColor(value: unknown): value is TaskBoardColor {
  return TASK_BOARD_COLORS.includes(value as TaskBoardColor);
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return TASK_PRIORITIES.includes(value as TaskPriority);
}

function isIsoDate(value: string): boolean {
  if (!TASK_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function requireNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(message);
  }

  return value.trim();
}

function requireInteger(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new BadRequestException(message);
  }

  return value;
}

function parseOptionalDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string' || !isIsoDate(value)) {
    throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
  }

  return value;
}

function parseAssigneeId(
  value: unknown,
  assignableUserIds: ReadonlySet<string>,
): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  return assignableUserIds.has(value) ? value : null;
}

function sanitizeNodeContent(
  value: unknown,
  ctx: SanitizeContext,
): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((child) => sanitizeNode(child, ctx))
    .filter((node): node is Record<string, unknown> => node !== null);
}

function sanitizeNode(
  value: unknown,
  ctx: SanitizeContext,
): Record<string, unknown> | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }

  if (!ALLOWED_TIPTAP_NODE_TYPES.has(value.type)) {
    return null;
  }

  if (value.type === (TaskBoardNodeName.TaskBoard as string)) {
    return {
      type: TaskBoardNodeName.TaskBoard,
      attrs: sanitizeTaskBoardAttrs(value.attrs, ctx),
    };
  }

  const next: Record<string, unknown> = { ...value };

  if (Array.isArray(value.content)) {
    next.content = sanitizeNodeContent(value.content, ctx);
  }

  return next;
}

function sanitizeDocLike(
  value: Record<string, unknown>,
  ctx: SanitizeContext,
): Record<string, unknown> {
  return {
    ...value,
    type: 'doc',
    content: sanitizeNodeContent(value.content, ctx),
  };
}

function sanitizeCardDescription(
  value: unknown,
  ctx: SanitizeContext,
): Record<string, unknown> {
  if (!isRecord(value) || value.type !== 'doc') {
    return getEmptyTaskDescription();
  }

  return sanitizeDocLike(value, ctx);
}

function sanitizeColumns(
  value: unknown,
): Array<{ id: string; name: string; color: TaskBoardColor; order: number }> {
  if (!Array.isArray(value)) {
    throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
  }

  const columns = value.map((column) => {
    if (!isRecord(column)) {
      throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
    }

    const id = requireNonEmptyString(
      column.id,
      ERROR_MESSAGES.TASK_BOARD_INVALID,
    );
    const name = requireNonEmptyString(
      column.name,
      ERROR_MESSAGES.TASK_BOARD_INVALID,
    );

    if (
      name.length < TASK_COLUMN_NAME_MIN_LENGTH ||
      name.length > TASK_COLUMN_NAME_MAX_LENGTH
    ) {
      throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
    }

    if (!isTaskBoardColor(column.color)) {
      throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID_COLOR);
    }

    const order = requireInteger(
      column.order,
      ERROR_MESSAGES.TASK_BOARD_INVALID,
    );

    return { id, name, color: column.color, order };
  });

  const ids = columns.map((column) => column.id);
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
  }

  const orders = columns.map((column) => column.order);
  if (new Set(orders).size !== orders.length) {
    throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
  }

  const expectedOrders = columns.map((_, index) => index);
  const sortedOrders = [...orders].sort((a, b) => a - b);
  if (sortedOrders.some((order, index) => order !== expectedOrders[index])) {
    throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
  }

  return columns
    .sort((a, b) => a.order - b.order)
    .map(({ id, name, color, order }) => ({ id, name, color, order }));
}

function sanitizeCards(
  value: unknown,
  columnIds: ReadonlySet<string>,
  ctx: SanitizeContext,
): Array<Record<string, unknown>> {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
  }

  const cards = value.map((card) => {
    if (!isRecord(card)) {
      throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
    }

    const id = requireNonEmptyString(
      card.id,
      ERROR_MESSAGES.TASK_BOARD_INVALID,
    );
    const columnId = requireNonEmptyString(
      card.columnId,
      ERROR_MESSAGES.TASK_BOARD_INVALID,
    );

    if (!columnIds.has(columnId)) {
      throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
    }

    if (typeof card.title !== 'string') {
      throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
    }

    const order = requireInteger(card.order, ERROR_MESSAGES.TASK_BOARD_INVALID);

    if (card.priority !== undefined && card.priority !== null) {
      if (!isTaskPriority(card.priority)) {
        throw new BadRequestException(
          ERROR_MESSAGES.TASK_BOARD_INVALID_PRIORITY,
        );
      }
    }

    return {
      id,
      columnId,
      title: card.title,
      order,
      priority: isTaskPriority(card.priority) ? card.priority : null,
      startDate: parseOptionalDate(card.startDate),
      dueDate: parseOptionalDate(card.dueDate),
      assigneeId: parseAssigneeId(card.assigneeId, ctx.assignableUserIds),
      description: sanitizeCardDescription(card.description, ctx),
    };
  });

  const ids = cards.map((card) => card.id);
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
  }

  return cards;
}

function sanitizeTaskBoardAttrs(
  value: unknown,
  ctx: SanitizeContext,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID);
  }

  const boardId = requireNonEmptyString(
    value.boardId,
    ERROR_MESSAGES.TASK_BOARD_INVALID,
  );
  const columns = sanitizeColumns(value.columns);
  const columnIds = new Set(columns.map((column) => column.id));
  const cards = sanitizeCards(value.cards, columnIds, ctx);

  return {
    boardId,
    columns,
    cards,
  };
}

export function sanitizePageContent(
  content: Record<string, unknown>,
  assignableUserIds: ReadonlySet<string>,
): Record<string, unknown> {
  if (!isRecord(content) || content.type !== 'doc') {
    throw new BadRequestException(ERROR_MESSAGES.PAGE_CONTENT_INVALID);
  }

  return sanitizeDocLike(content, { assignableUserIds });
}
