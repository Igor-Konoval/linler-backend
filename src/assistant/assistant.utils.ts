import {
  ASSISTANT_ACTION_LIMITS,
  ASSISTANT_ACTION_PATTERN,
  ASSISTANT_BOARD_COLORS,
  ASSISTANT_HIGHLIGHT_COLORS,
  ASSISTANT_LIMITS,
  ASSISTANT_TEXT_COLORS,
} from 'src/constants/assistant.constants';
import { ProjectVisibility } from 'src/projects/enums/project.enums';
import type {
  AssistantAction,
  AssistantContentBlock,
  AssistantContextTable,
  AssistantPageBlockInsertionResult,
  AssistantPageTableMutation,
  AssistantTextMatchResult,
  AssistantTaskMoveResult,
  ExtractedAssistantAction,
} from 'src/types/assistant.type';

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function boundedText(value: unknown, max: number): string | null {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractAssistantAction(
  reply: string,
): ExtractedAssistantAction {
  const match = ASSISTANT_ACTION_PATTERN.exec(reply);

  if (!match || match.index === undefined) {
    return { text: reply.trim(), action: null };
  }

  const text =
    `${reply.slice(0, match.index)}${reply.slice(match.index + match[0].length)}`
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  return { text, action: parseAction(match[1]) };
}

function parseAction(raw: string): AssistantAction | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const actionType = clip(parsed.type, 40);

  if (actionType === 'createWorkspace') {
    const name = clip(parsed.name, 120);
    return name.length >= 2 ? { type: actionType, name } : null;
  }

  if (actionType === 'renameWorkspace') {
    const workspaceId = clip(parsed.workspaceId, 80);
    const name = clip(parsed.name, 120);
    return workspaceId && name.length >= 2
      ? { type: actionType, workspaceId, name }
      : null;
  }

  if (actionType === 'renameProject') {
    const projectId = clip(parsed.projectId, 80);
    const name = clip(parsed.name, ASSISTANT_ACTION_LIMITS.NAME_MAX_LENGTH);
    return projectId && name ? { type: actionType, projectId, name } : null;
  }

  if (actionType === 'renamePage') {
    const pageId = clip(parsed.pageId, 80);
    const title = clip(parsed.title, ASSISTANT_ACTION_LIMITS.TITLE_MAX_LENGTH);
    return pageId && title ? { type: actionType, pageId, title } : null;
  }

  if (actionType === 'replacePageText') {
    const pageId = clip(parsed.pageId, 80);
    const findText = boundedText(parsed.findText, 500);
    const replaceText = boundedText(parsed.replaceText, 500);
    return pageId && findText?.trim() && replaceText?.trim()
      ? { type: actionType, pageId, findText, replaceText }
      : null;
  }

  if (actionType === 'moveTask') {
    const pageId = clip(parsed.pageId, 80);
    const boardId = clip(parsed.boardId, 120);
    const cardId = clip(parsed.cardId, 120);
    const targetColumn = clip(parsed.targetColumn, 80);
    return pageId && boardId && cardId && targetColumn
      ? { type: actionType, pageId, boardId, cardId, targetColumn }
      : null;
  }

  if (actionType === 'insertPageBlocks') {
    const pageId = clip(parsed.pageId, 80);
    const afterText = clip(parsed.afterText, 500);
    const blocks = parseBlocks(parsed).filter((block) =>
      ['paragraph', 'heading', 'bulletList', 'orderedList'].includes(
        block.type,
      ),
    );

    return pageId && afterText && blocks.length > 0
      ? { type: actionType, pageId, afterText, blocks }
      : null;
  }

  if (actionType === 'appendTableRow' || actionType === 'addTableColumn') {
    const pageId = clip(parsed.pageId, 80);
    const tableIndex = parsed.tableIndex;
    const headers = parseTableHeaders(parsed.headers);

    if (
      !pageId ||
      typeof tableIndex !== 'number' ||
      !Number.isInteger(tableIndex) ||
      tableIndex < 1 ||
      tableIndex > ASSISTANT_LIMITS.TABLES_MAX_ITEMS ||
      !headers
    ) {
      return null;
    }

    if (actionType === 'appendTableRow') {
      const values = parseCellValues(
        parsed.values,
        ASSISTANT_LIMITS.TABLE_COLUMNS_MAX_ITEMS,
      );

      return values
        ? { type: actionType, pageId, tableIndex, headers, values }
        : null;
    }

    const header = clip(parsed.header, ASSISTANT_ACTION_LIMITS.CELL_MAX_LENGTH);
    const values =
      parsed.values === undefined
        ? undefined
        : parseCellValues(parsed.values, 100);

    return header && (parsed.values === undefined || values)
      ? {
          type: actionType,
          pageId,
          tableIndex,
          headers,
          header,
          ...(values ? { values } : {}),
        }
      : null;
  }

  if (actionType && actionType !== 'createProject') {
    return null;
  }

  const projectName = clip(
    parsed.projectName,
    ASSISTANT_ACTION_LIMITS.NAME_MAX_LENGTH,
  );
  const pageTitle =
    clip(parsed.pageTitle, ASSISTANT_ACTION_LIMITS.TITLE_MAX_LENGTH) ||
    projectName;
  const blocks = parseBlocks(parsed);
  let visibility: ProjectVisibility | undefined;

  if (parsed.visibility !== undefined) {
    if (
      parsed.visibility !== ProjectVisibility.PRIVATE &&
      parsed.visibility !== ProjectVisibility.WORKSPACE
    ) {
      return null;
    }

    visibility = parsed.visibility;
  }

  if (!projectName || !pageTitle || blocks.length === 0) {
    return null;
  }

  const workspaceId = clip(parsed.workspaceId, 80);
  const icon = clip(parsed.icon, 16);

  return {
    type: 'createProject',
    workspaceId: workspaceId || undefined,
    projectName,
    visibility,
    pageTitle,
    icon: icon || undefined,
    blocks,
  };
}

function parseBlocks(parsed: Record<string, unknown>): AssistantContentBlock[] {
  const blocks = Array.isArray(parsed.blocks)
    ? parsed.blocks.filter(isRecord).slice(0, 20).map(parseBlock)
    : [];
  const ready = blocks.filter((block): block is AssistantContentBlock =>
    Boolean(block),
  );

  if (ready.length > 0) {
    return ready;
  }

  const headers = stringList(
    parsed.headers,
    ASSISTANT_ACTION_LIMITS.HEADER_MAX_ITEMS,
  );

  if (headers.length === 0) {
    return [];
  }

  return [
    {
      type: 'table',
      headers,
      rows: tableRows(parsed.rows, headers.length),
    },
  ];
}

function parseBlock(
  block: Record<string, unknown>,
): AssistantContentBlock | null {
  const type = clip(block.type, 40);

  if (type === 'table') {
    const headers = stringList(
      block.headers,
      ASSISTANT_ACTION_LIMITS.HEADER_MAX_ITEMS,
    );

    if (headers.length === 0) {
      return null;
    }

    return { type, headers, rows: tableRows(block.rows, headers.length) };
  }

  if (type === 'taskBoard') {
    const columns = stringList(block.columns, 6);

    if (columns.length === 0) {
      return null;
    }

    const cards = Array.isArray(block.cards)
      ? block.cards
          .filter(isRecord)
          .slice(0, 12)
          .map((card) => ({
            title: clip(card.title, ASSISTANT_ACTION_LIMITS.CELL_MAX_LENGTH),
            column: clip(card.column, ASSISTANT_ACTION_LIMITS.CELL_MAX_LENGTH),
          }))
      : [];

    return { type, columns, cards };
  }

  if (type === 'bulletList' || type === 'orderedList') {
    const items = stringList(block.items, 12);

    return items.length > 0 ? { type, items } : null;
  }

  if (type === 'heading' || type === 'paragraph') {
    const text = clip(block.text, 500);

    if (!text) {
      return null;
    }

    const level =
      type === 'heading'
        ? Math.min(3, Math.max(1, Number(block.level) || 2))
        : undefined;

    return {
      type,
      text,
      level,
      marks: stringList(block.marks, 4).filter((mark) =>
        ['bold', 'italic', 'strike', 'code'].includes(mark),
      ),
      color: parsePaletteColor(block.color, ASSISTANT_TEXT_COLORS),
      highlightColor: parsePaletteColor(
        block.highlightColor,
        ASSISTANT_HIGHLIGHT_COLORS,
      ),
    };
  }

  return null;
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => clip(item, ASSISTANT_ACTION_LIMITS.CELL_MAX_LENGTH))
    .filter((item) => item.length > 0)
    .slice(0, max);
}

function parseTableHeaders(value: unknown): string[] | null {
  const headers = parseCellValues(
    value,
    ASSISTANT_LIMITS.TABLE_COLUMNS_MAX_ITEMS,
  );

  return headers?.length && headers.every((header) => header.length > 0)
    ? headers
    : null;
}

function parseCellValues(value: unknown, maxItems: number): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    !value.every((item) => typeof item === 'string')
  ) {
    return null;
  }

  return value.map((item) =>
    item.trim().slice(0, ASSISTANT_ACTION_LIMITS.CELL_MAX_LENGTH),
  );
}

function tableRows(value: unknown, width: number): string[][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, ASSISTANT_ACTION_LIMITS.ROW_MAX_ITEMS).map((row) => {
    const cells = Array.isArray(row) ? row : [];

    return Array.from({ length: width }, (_, index) =>
      clip(cells[index], ASSISTANT_ACTION_LIMITS.CELL_MAX_LENGTH),
    );
  });
}

function parsePaletteColor(
  value: unknown,
  palette: ReadonlySet<string>,
): string | undefined {
  return typeof value === 'string' && palette.has(value.toLowerCase())
    ? value.toLowerCase()
    : undefined;
}

function paragraph(
  text: string,
  marks: string[] = [],
  color?: string,
  highlightColor?: string,
): Record<string, unknown> {
  if (!text) {
    return { type: 'paragraph' };
  }

  const nodeMarks: Record<string, unknown>[] = marks.map((type) => ({ type }));

  if (color) {
    nodeMarks.push({
      type: 'textStyle',
      attrs: { color },
    });
  }

  if (highlightColor) {
    nodeMarks.push({
      type: 'highlight',
      attrs: { color: highlightColor },
    });
  }

  return {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text,
        ...(nodeMarks.length > 0 ? { marks: nodeMarks } : {}),
      },
    ],
  };
}

function tableNode(
  headers: string[],
  rows: string[][],
): Record<string, unknown> {
  const cell = (
    type: 'tableHeader' | 'tableCell',
    text: string,
  ): Record<string, unknown> => ({ type, content: [paragraph(text)] });

  return {
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: headers.map((header) => cell('tableHeader', header)),
      },
      ...rows.map((row) => ({
        type: 'tableRow',
        content: headers.map((_, index) => cell('tableCell', row[index] ?? '')),
      })),
    ],
  };
}

function taskBoardNode(block: AssistantContentBlock): Record<string, unknown> {
  const columns = (block.columns ?? []).map((name, order) => ({
    id: `column-${order + 1}`,
    name,
    color: ASSISTANT_BOARD_COLORS[order % ASSISTANT_BOARD_COLORS.length],
    order,
  }));
  const columnIdByName = new Map(
    columns.map((column) => [column.name.toLowerCase(), column.id]),
  );
  const orders = new Map<string, number>();
  const cards = (block.cards ?? [])
    .filter((card) => card.title)
    .map((card) => {
      const columnId =
        columnIdByName.get((card.column ?? '').toLowerCase()) ?? columns[0].id;
      const order = orders.get(columnId) ?? 0;
      orders.set(columnId, order + 1);

      return {
        id: `card-${order + 1}-${columnId}`,
        columnId,
        title: card.title,
        order,
        priority: null,
        startDate: null,
        dueDate: null,
        assigneeId: null,
        description: { type: 'doc', content: [{ type: 'paragraph' }] },
      };
    });

  return {
    type: 'taskBoard',
    attrs: {
      boardId: `board-${columns[0]?.id ?? '1'}`,
      columns,
      cards,
    },
  };
}

export function pageDocument(
  blocks: AssistantContentBlock[],
): Record<string, unknown> {
  return {
    type: 'doc',
    content: blocks.flatMap((block) => {
      if (block.type === 'table' && block.headers) {
        return [tableNode(block.headers, block.rows ?? [])];
      }

      if (block.type === 'taskBoard') {
        return [taskBoardNode(block)];
      }

      if (
        (block.type === 'bulletList' || block.type === 'orderedList') &&
        block.items
      ) {
        return [
          {
            type: block.type,
            content: block.items.map((item) => ({
              type: 'listItem',
              content: [paragraph(item)],
            })),
          },
        ];
      }

      if (block.type === 'heading' && block.text) {
        return [
          {
            type: 'heading',
            attrs: { level: block.level ?? 2 },
            content: paragraph(
              block.text,
              block.marks,
              block.color,
              block.highlightColor,
            ).content,
          },
        ];
      }

      if (block.type === 'paragraph' && block.text) {
        return [
          paragraph(block.text, block.marks, block.color, block.highlightColor),
        ];
      }

      return [];
    }),
  };
}

function getNodeText(value: unknown): string {
  if (!isRecord(value)) {
    return '';
  }

  if (value.type === 'text' && typeof value.text === 'string') {
    return value.text;
  }

  if (!Array.isArray(value.content)) {
    return '';
  }

  const separator = value.type === 'paragraph' ? '' : ' ';
  return value.content.map(getNodeText).join(separator);
}

function getTableCells(
  row: Record<string, unknown>,
): Record<string, unknown>[] {
  return Array.isArray(row.content)
    ? row.content.filter(
        (cell): cell is Record<string, unknown> =>
          isRecord(cell) &&
          (cell.type === 'tableHeader' || cell.type === 'tableCell'),
      )
    : [];
}

export function extractPageTables(
  content: Record<string, unknown>,
): AssistantContextTable[] {
  const tables: AssistantContextTable[] = [];
  let tableIndex = 0;

  const visit = (value: unknown) => {
    if (!isRecord(value)) {
      return;
    }

    if (value.type === 'table') {
      tableIndex += 1;

      if (tables.length >= ASSISTANT_LIMITS.TABLES_MAX_ITEMS) {
        return;
      }

      const rows = Array.isArray(value.content)
        ? value.content.filter(
            (row): row is Record<string, unknown> =>
              isRecord(row) && row.type === 'tableRow',
          )
        : [];
      const headerCells = rows.length > 0 ? getTableCells(rows[0]) : [];
      const dataRows = rows.slice(1);
      let columnsTruncated =
        headerCells.length > ASSISTANT_LIMITS.TABLE_COLUMNS_MAX_ITEMS;
      let cellsTruncated = false;
      const readCell = (cell: Record<string, unknown>) => {
        const text = getNodeText(cell).replace(/\s+/g, ' ').trim();

        if (text.length > ASSISTANT_LIMITS.TABLE_CELL_MAX_CHARS) {
          cellsTruncated = true;
        }

        return text.slice(0, ASSISTANT_LIMITS.TABLE_CELL_MAX_CHARS);
      };
      const headers = headerCells
        .slice(0, ASSISTANT_LIMITS.TABLE_COLUMNS_MAX_ITEMS)
        .map(readCell);
      const tableRows = dataRows
        .slice(0, ASSISTANT_LIMITS.TABLE_ROWS_MAX_ITEMS)
        .map((row) => {
          const cells = getTableCells(row);

          if (cells.length > ASSISTANT_LIMITS.TABLE_COLUMNS_MAX_ITEMS) {
            columnsTruncated = true;
          }

          return cells
            .slice(0, ASSISTANT_LIMITS.TABLE_COLUMNS_MAX_ITEMS)
            .map(readCell);
        });

      tables.push({
        index: tableIndex,
        headers,
        rows: tableRows,
        rowCount: dataRows.length,
        rowsTruncated: dataRows.length > ASSISTANT_LIMITS.TABLE_ROWS_MAX_ITEMS,
        columnsTruncated,
        cellsTruncated,
      });

      return;
    }

    if (Array.isArray(value.content)) {
      value.content.forEach(visit);
    }
  };

  visit(content);
  return tables;
}

function mutatePageTable(
  content: Record<string, unknown>,
  tableIndex: number,
  expectedHeaders: string[],
  updateTable: (
    table: Record<string, unknown>,
    rows: Record<string, unknown>[],
    headers: string[],
  ) => {
    table: Record<string, unknown>;
    changed: boolean;
    shapeMismatch: boolean;
  },
): AssistantPageTableMutation {
  let currentIndex = 0;
  let matches = 0;
  let changed = false;
  let shapeMismatch = false;

  const visit = (value: unknown): unknown => {
    if (!isRecord(value)) {
      return value;
    }

    if (value.type === 'table') {
      currentIndex += 1;

      if (currentIndex !== tableIndex) {
        return value;
      }

      const rows = Array.isArray(value.content)
        ? value.content.filter(
            (row): row is Record<string, unknown> =>
              isRecord(row) && row.type === 'tableRow',
          )
        : [];
      const actualHeaders =
        rows.length > 0
          ? getTableCells(rows[0]).map((cell) =>
              getNodeText(cell).replace(/\s+/g, ' ').trim(),
            )
          : [];

      if (
        actualHeaders.length !== expectedHeaders.length ||
        actualHeaders.some((header, index) => header !== expectedHeaders[index])
      ) {
        return value;
      }

      matches = 1;

      if (
        !Array.isArray(value.content) ||
        rows.length !== value.content.length
      ) {
        shapeMismatch = true;
        return value;
      }

      const result = updateTable(value, rows, actualHeaders);
      changed = result.changed;
      shapeMismatch = result.shapeMismatch;
      return result.table;
    }

    if (Array.isArray(value.content)) {
      return {
        ...value,
        content: value.content.map(visit).filter((child) => child !== null),
      };
    }

    return value;
  };

  const next = visit(content);

  return {
    content: isRecord(next) ? next : content,
    matches,
    changed,
    shapeMismatch,
  };
}

function hasExpectedTableShape(
  rows: Record<string, unknown>[],
  width: number,
): boolean {
  return rows.every((row) => getTableCells(row).length === width);
}

export function appendTableRow(
  content: Record<string, unknown>,
  tableIndex: number,
  headers: string[],
  values: string[],
): AssistantPageTableMutation {
  return mutatePageTable(content, tableIndex, headers, (table, rows) => {
    if (
      values.length !== headers.length ||
      !hasExpectedTableShape(rows, headers.length)
    ) {
      return { table, changed: false, shapeMismatch: true };
    }

    const newRow = {
      type: 'tableRow',
      content: headers.map((_, index) => ({
        type: 'tableCell',
        content: [paragraph(values[index])],
      })),
    };

    return {
      table: {
        ...table,
        content: [...rows, newRow],
      },
      changed: true,
      shapeMismatch: false,
    };
  });
}

export function addTableColumn(
  content: Record<string, unknown>,
  tableIndex: number,
  headers: string[],
  header: string,
  values?: string[],
): AssistantPageTableMutation {
  return mutatePageTable(content, tableIndex, headers, (table, rows) => {
    const cellValues =
      values ?? Array.from({ length: rows.length - 1 }, () => '');

    if (
      headers.length >= ASSISTANT_LIMITS.TABLE_COLUMNS_MAX_ITEMS ||
      rows.length === 0 ||
      !hasExpectedTableShape(rows, headers.length) ||
      cellValues.length !== rows.length - 1
    ) {
      return { table, changed: false, shapeMismatch: true };
    }

    return {
      table: {
        ...table,
        content: rows.map((row, index) => ({
          ...row,
          content: [
            ...getTableCells(row),
            {
              type: index === 0 ? 'tableHeader' : 'tableCell',
              content: [
                paragraph(index === 0 ? header : cellValues[index - 1]),
              ],
            },
          ],
        })),
      },
      changed: true,
      shapeMismatch: false,
    };
  });
}

export function insertPageBlocksAfterText(
  content: Record<string, unknown>,
  afterText: string,
  blocks: AssistantContentBlock[],
): AssistantPageBlockInsertionResult {
  if (!Array.isArray(content.content)) {
    return { content, matches: 0, changed: false };
  }

  const topLevelContent: unknown[] = content.content;
  const matchingIndexes = topLevelContent
    .map((node, index) =>
      getNodeText(node).replace(/\s+/g, ' ').trim() === afterText ? index : -1,
    )
    .filter((index) => index >= 0);

  if (matchingIndexes.length !== 1) {
    return {
      content,
      matches: matchingIndexes.length,
      changed: false,
    };
  }

  const inserted = pageDocument(blocks).content;

  if (!Array.isArray(inserted) || inserted.length === 0) {
    return { content, matches: 1, changed: false };
  }
  const insertedNodes: unknown[] = inserted;

  const index = matchingIndexes[0];

  return {
    content: {
      ...content,
      content: [
        ...topLevelContent.slice(0, index + 1),
        ...insertedNodes,
        ...topLevelContent.slice(index + 1),
      ],
    },
    matches: 1,
    changed: true,
  };
}

export function replacePageText(
  content: Record<string, unknown>,
  findText: string,
  replaceText: string,
): AssistantTextMatchResult {
  let matches = 0;

  const visit = (value: unknown): unknown => {
    if (!isRecord(value)) {
      return value;
    }

    let node: Record<string, unknown> = value;

    if (value.type === 'text' && typeof value.text === 'string' && findText) {
      const firstIndex = value.text.indexOf(findText);

      if (firstIndex >= 0) {
        let occurrences = 0;
        let nextIndex = firstIndex;

        while (nextIndex >= 0) {
          occurrences += 1;
          nextIndex = value.text.indexOf(findText, nextIndex + 1);
        }

        matches += occurrences;

        if (occurrences === 1) {
          node = {
            ...value,
            text: `${value.text.slice(0, firstIndex)}${replaceText}${value.text.slice(firstIndex + findText.length)}`,
          };
        }
      }
    }

    if (Array.isArray(node.content)) {
      node = {
        ...node,
        content: node.content.map(visit).filter((child) => child !== null),
      };
    }

    return node;
  };

  const next = visit(content);

  return {
    content: isRecord(next) ? next : content,
    matches,
  };
}

export function moveTaskCard(
  content: Record<string, unknown>,
  boardId: string,
  cardId: string,
  targetColumn: string,
): AssistantTaskMoveResult {
  let matches = 0;
  let changed = false;

  const visit = (value: unknown): unknown => {
    if (!isRecord(value)) {
      return value;
    }

    let node: Record<string, unknown> = value;

    if (
      value.type === 'taskBoard' &&
      isRecord(value.attrs) &&
      value.attrs.boardId === boardId
    ) {
      const columns = Array.isArray(value.attrs.columns)
        ? value.attrs.columns.filter(isRecord)
        : [];
      const target = columns.find(
        (column) =>
          typeof column.name === 'string' &&
          column.name.toLowerCase() === targetColumn.toLowerCase(),
      );
      const cards = Array.isArray(value.attrs.cards)
        ? value.attrs.cards.filter(isRecord)
        : [];
      const matchingCards = cards.filter((card) => card.id === cardId);

      if (target && typeof target.id === 'string' && matchingCards.length > 0) {
        matches += matchingCards.length;

        if (matchingCards.length === 1) {
          const current = matchingCards[0];
          const sourceColumnId = current.columnId;

          if (sourceColumnId !== target.id) {
            const targetOrder = cards.reduce((max, card) => {
              const order =
                card.columnId === target.id && typeof card.order === 'number'
                  ? card.order
                  : -1;
              return Math.max(max, order);
            }, -1);
            const sourceOrder =
              typeof current.order === 'number' ? current.order : -1;

            node = {
              ...value,
              attrs: {
                ...value.attrs,
                cards: cards.map((card) => {
                  if (card.id === cardId) {
                    return {
                      ...card,
                      columnId: target.id,
                      order: targetOrder + 1,
                    };
                  }

                  if (
                    card.columnId === sourceColumnId &&
                    typeof card.order === 'number' &&
                    card.order > sourceOrder
                  ) {
                    return { ...card, order: card.order - 1 };
                  }

                  return card;
                }),
              },
            };
            changed = true;
          }
        }
      }
    }

    if (Array.isArray(node.content)) {
      node = {
        ...node,
        content: node.content.map(visit).filter((child) => child !== null),
      };
    }

    return node;
  };

  const next = visit(content);

  return {
    content: isRecord(next) ? next : content,
    matches,
    changed,
  };
}
