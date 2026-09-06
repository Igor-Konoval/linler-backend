import { TaskBoardNodeName } from '../enums/task-board.enums';

export type TaskCardSnapshot = {
  boardId: string;
  cardId: string;
  title: string;
  columnId: string;
  columnName: string;
  assigneeId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walkNodes(
  node: unknown,
  visit: (node: Record<string, unknown>) => void,
): void {
  if (!isRecord(node)) {
    return;
  }

  visit(node);

  const content = node.content;

  if (!Array.isArray(content)) {
    return;
  }

  for (const child of content) {
    walkNodes(child, visit);
  }
}

export function collectTaskCards(content: unknown): TaskCardSnapshot[] {
  const cards: TaskCardSnapshot[] = [];

  walkNodes(content, (node) => {
    if (node.type !== TaskBoardNodeName.TaskBoard) {
      return;
    }

    const attrs = isRecord(node.attrs) ? node.attrs : {};
    const boardId = typeof attrs.boardId === 'string' ? attrs.boardId : '';
    const columns = Array.isArray(attrs.columns) ? attrs.columns : [];
    const columnNameById = new Map<string, string>();

    for (const column of columns) {
      if (!isRecord(column)) {
        continue;
      }

      if (typeof column.id === 'string' && typeof column.name === 'string') {
        columnNameById.set(column.id, column.name);
      }
    }

    const rawCards = Array.isArray(attrs.cards) ? attrs.cards : [];

    for (const card of rawCards) {
      if (!isRecord(card) || typeof card.id !== 'string') {
        continue;
      }

      const columnId = typeof card.columnId === 'string' ? card.columnId : '';

      cards.push({
        boardId,
        cardId: card.id,
        title: typeof card.title === 'string' ? card.title : 'Untitled',
        columnId,
        columnName: columnNameById.get(columnId) ?? 'Unknown',
        assigneeId:
          typeof card.assigneeId === 'string' ? card.assigneeId : null,
      });
    }
  });

  return cards;
}
