import { BadRequestException } from '@nestjs/common';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import { getEmptyTaskDescription } from '../constants/task-board.constants';
import { sanitizePageContent } from './sanitize-page-content.util';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';
const STRANGER_ID = '22222222-2222-4222-8222-222222222222';

function boardDoc(attrs: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'doc',
    content: [
      {
        type: 'taskBoard',
        attrs,
      },
    ],
  };
}

function defaultColumn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'col-1',
    name: 'Not started',
    color: 'gray',
    order: 0,
    ...overrides,
  };
}

function defaultCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'card-1',
    columnId: 'col-1',
    title: 'First task',
    order: 0,
    priority: 'high',
    startDate: null,
    dueDate: '2026-09-01',
    assigneeId: null,
    description: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Details' }],
        },
        {
          type: 'image',
          attrs: {
            attachmentId: 'att-1',
            alt: 'screenshot',
          },
        },
      ],
    },
    ...overrides,
  };
}

function validAttrs(overrides: Record<string, unknown> = {}) {
  return {
    boardId: 'board-1',
    columns: [defaultColumn()],
    cards: [defaultCard()],
    ...overrides,
  };
}

describe('sanitizePageContent', () => {
  const members = new Set([MEMBER_ID]);

  it('keeps taskBoard columns, cards and nested description (including images)', () => {
    const input = boardDoc(validAttrs());
    const result = sanitizePageContent(input, members);

    expect(result).toEqual(input);
  });

  it('allows several taskBoard nodes on one page', () => {
    const input = {
      type: 'doc',
      content: [
        {
          type: 'taskBoard',
          attrs: validAttrs({ boardId: 'board-a' }),
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'between boards' }],
        },
        {
          type: 'taskBoard',
          attrs: validAttrs({
            boardId: 'board-b',
            columns: [
              defaultColumn({ id: 'col-2', name: 'Done', color: 'green' }),
            ],
            cards: [
              defaultCard({
                id: 'card-2',
                columnId: 'col-2',
                title: 'Other board',
                priority: null,
              }),
            ],
          }),
        },
      ],
    };

    expect(sanitizePageContent(input, members)).toEqual(input);
  });

  it('fills empty description for old cards', () => {
    const input = boardDoc(
      validAttrs({
        cards: [defaultCard({ description: undefined })],
      }),
    );

    const result = sanitizePageContent(input, members);
    const board = (result.content as Array<Record<string, unknown>>)[0];
    const attrs = board.attrs as Record<string, unknown>;
    const cards = attrs.cards as Array<Record<string, unknown>>;

    expect(cards[0].description).toEqual(getEmptyTaskDescription());
  });

  it('resets assigneeId that is not a project member', () => {
    const input = boardDoc(
      validAttrs({
        cards: [defaultCard({ assigneeId: STRANGER_ID })],
      }),
    );

    const result = sanitizePageContent(input, members);
    const board = (result.content as Array<Record<string, unknown>>)[0];
    const attrs = board.attrs as Record<string, unknown>;
    const cards = attrs.cards as Array<Record<string, unknown>>;

    expect(cards[0].assigneeId).toBeNull();
  });

  it('keeps assigneeId of a project member', () => {
    const input = boardDoc(
      validAttrs({
        cards: [defaultCard({ assigneeId: MEMBER_ID })],
      }),
    );

    const result = sanitizePageContent(input, members);
    const board = (result.content as Array<Record<string, unknown>>)[0];
    const attrs = board.attrs as Record<string, unknown>;
    const cards = attrs.cards as Array<Record<string, unknown>>;

    expect(cards[0].assigneeId).toBe(MEMBER_ID);
  });

  it('rejects unknown color with 400', () => {
    expect(() =>
      sanitizePageContent(
        boardDoc(
          validAttrs({
            columns: [defaultColumn({ color: 'cyan' })],
          }),
        ),
        members,
      ),
    ).toThrow(new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID_COLOR));
  });

  it('rejects unknown priority with 400', () => {
    expect(() =>
      sanitizePageContent(
        boardDoc(
          validAttrs({
            cards: [defaultCard({ priority: 'urgent' })],
          }),
        ),
        members,
      ),
    ).toThrow(
      new BadRequestException(ERROR_MESSAGES.TASK_BOARD_INVALID_PRIORITY),
    );
  });

  it('rejects a card whose columnId is not on this board', () => {
    expect(() =>
      sanitizePageContent(
        boardDoc(
          validAttrs({
            cards: [defaultCard({ columnId: 'foreign-column' })],
          }),
        ),
        members,
      ),
    ).toThrow(BadRequestException);
  });

  it('strips unknown node types and keeps allowed ones', () => {
    const result = sanitizePageContent(
      {
        type: 'doc',
        content: [
          { type: 'malware', attrs: { payload: 'x' } },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'ok' }],
          },
        ],
      },
      members,
    );

    expect(result).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'ok' }],
        },
      ],
    });
  });
});
