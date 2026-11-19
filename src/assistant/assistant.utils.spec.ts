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

describe('assistant action helpers', () => {
  it('parses create-workspace actions and rejects unknown action types', () => {
    expect(
      extractAssistantAction(
        'Создам.\n```assistant-action\n{"type":"createWorkspace","name":"Design"}\n```',
      ).action,
    ).toEqual({ type: 'createWorkspace', name: 'Design' });

    expect(
      extractAssistantAction(
        'Done.\n```assistant-action\n{"type":"deleteWorkspace","workspaceId":"workspace-1"}\n```',
      ).action,
    ).toBeNull();
  });

  it('replaces a unique phrase within a text node and preserves formatting', () => {
    const result = replacePageText(
      {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [
              {
                type: 'text',
                text: 'Old title',
                marks: [{ type: 'bold' }],
              },
            ],
          },
        ],
      },
      'Old',
      'New title',
    );

    expect(result.matches).toBe(1);
    expect(result.content).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            {
              type: 'text',
              text: 'New title title',
              marks: [{ type: 'bold' }],
            },
          ],
        },
      ],
    });
  });

  it('extracts table headers and data rows for assistant context', () => {
    const content = pageDocument([
      {
        type: 'table',
        headers: ['Metric', 'Value', 'Change'],
        rows: [
          ['Revenue', '$120,000', '+8%'],
          ['Users', '4,200', '+12%'],
        ],
      },
    ]);

    expect(extractPageTables(content)).toEqual([
      {
        index: 1,
        headers: ['Metric', 'Value', 'Change'],
        rows: [
          ['Revenue', '$120,000', '+8%'],
          ['Users', '4,200', '+12%'],
        ],
        rowCount: 2,
        rowsTruncated: false,
        columnsTruncated: false,
        cellsTruncated: false,
      },
    ]);
  });

  it('appends a row and adds a column while preserving existing table data', () => {
    const content = pageDocument([
      {
        type: 'table',
        headers: ['Metric', 'Value'],
        rows: [
          ['Revenue', '$120,000'],
          ['Users', '4,200'],
        ],
      },
    ]);
    const appended = appendTableRow(
      content,
      1,
      ['Metric', 'Value'],
      ['Retention', '92%'],
    );
    const extended = addTableColumn(
      appended.content,
      1,
      ['Metric', 'Value'],
      'Change',
      ['+8%', '+2%', ''],
    );

    expect(appended.matches).toBe(1);
    expect(appended.changed).toBe(true);
    expect(extended.matches).toBe(1);
    expect(extended.changed).toBe(true);
    expect(extended.shapeMismatch).toBe(false);
    expect(extractPageTables(extended.content)[0]).toMatchObject({
      headers: ['Metric', 'Value', 'Change'],
      rows: [
        ['Revenue', '$120,000', '+8%'],
        ['Users', '4,200', '+2%'],
        ['Retention', '92%', ''],
      ],
      rowCount: 3,
    });

    const invalid = addTableColumn(content, 1, ['Metric', 'Value'], 'Change', [
      'Only one value',
    ]);
    expect(invalid.shapeMismatch).toBe(true);
    expect(invalid.changed).toBe(false);
  });

  it('inserts requested text blocks after one matching heading', () => {
    const content = pageDocument([
      { type: 'heading', text: 'Key metrics' },
      { type: 'paragraph', text: 'Existing details' },
    ]);
    const result = insertPageBlocksAfterText(content, 'Key metrics', [
      { type: 'bulletList', items: ['New metric'] },
    ]);
    const originalBlocks = Array.isArray(content.content)
      ? content.content
      : [];

    expect(result.matches).toBe(1);
    expect(result.changed).toBe(true);
    expect(result.content.content).toEqual([
      originalBlocks[0],
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'New metric' }],
              },
            ],
          },
        ],
      },
      originalBlocks[1],
    ]);
  });

  it('moves a card and compacts its previous status order', () => {
    const result = moveTaskCard(
      {
        type: 'doc',
        content: [
          {
            type: 'taskBoard',
            attrs: {
              boardId: 'board-1',
              columns: [
                { id: 'todo', name: 'To do' },
                { id: 'done', name: 'Done' },
              ],
              cards: [
                { id: 'card-1', title: 'Build', columnId: 'todo', order: 0 },
                { id: 'card-2', title: 'Review', columnId: 'todo', order: 1 },
                { id: 'card-3', title: 'Ship', columnId: 'done', order: 0 },
              ],
            },
          },
        ],
      },
      'board-1',
      'card-1',
      'Done',
    );

    expect(result.matches).toBe(1);
    expect(result.changed).toBe(true);
    expect(result.content).toEqual({
      type: 'doc',
      content: [
        {
          type: 'taskBoard',
          attrs: {
            boardId: 'board-1',
            columns: [
              { id: 'todo', name: 'To do' },
              { id: 'done', name: 'Done' },
            ],
            cards: [
              { id: 'card-1', title: 'Build', columnId: 'done', order: 1 },
              { id: 'card-2', title: 'Review', columnId: 'todo', order: 0 },
              { id: 'card-3', title: 'Ship', columnId: 'done', order: 0 },
            ],
          },
        },
      ],
    });
  });
});
