# AI assistant

A signed-in user with an active subscription can ask the assistant to create workspaces and projects, rename workspaces, projects, and pages, edit matching page text, add text blocks, append table rows, add table columns, move task cards between existing board columns, draft page text, summarize visible activity, and answer questions about it. Existing workspace/project/page services enforce the user's normal permissions. The reply follows the language of the latest message. Conversations and drafts are stored in this browser. Workspace-visible projects are visible to workspace members, not the public internet. New projects get one default page with the requested blocks and emoji icon.

## Endpoint

`POST /api/assistant/chat`

Send a bearer access token. Body: `message` (required, 1–2000 characters) and optional `history` (up to 10 `{ role, content }` items, roles `user` or `assistant`; each content is 1–20,000 characters). Response: `{ reply, changed }`.

`/swagger` is the field reference.

## Environment

| Name             | Required | Purpose                                              |
| ---------------- | -------- | ---------------------------------------------------- |
| `GEMINI_API_KEY` | Yes      | Free Google AI Studio key                            |
| `GEMINI_MODEL`   | No       | Free Flash model. Empty uses `gemini-3.5-flash-lite` |

Keep the key in the local environment only. Do not commit it.

## Free key

1. Open [Google AI Studio](https://aistudio.google.com/) and sign in with a Google account.
2. Create an API key. This path does not ask for a card.
3. Put that key in `GEMINI_API_KEY`.
4. Leave `GEMINI_MODEL` empty. The key is not tied to one model. An empty value uses the free `gemini-3.5-flash-lite` model. Do not point this slice at a paid model.

## Context sent to the model

The request includes a short system prompt plus:

- each workspace the user belongs to, with id, name, and role
- projects in those workspaces that the user can see: a private project is included only when the user owns it or is a member
- page titles, editable text nodes, structured table data, and task-board context for visible project pages
- up to 8 newest notifications that belong to this user: type, workspace name, actor username, page title, card title, column name, previous column name, and read state

Avatar URLs and user ids are left out. The context is capped at 12,000 characters; page text and table rows are separately bounded. If table headers, columns, rows, or cell text are truncated, the assistant must not use incomplete information to perform an edit.

Table actions identify a table by its 1-based position on the page and the exact list of existing headers. Appending a row requires a value per header. Adding a column requires a header; values are optional and omitted values create blank cells. Adding text blocks requires a unique existing top-level text block as the insertion anchor.

## Out of scope

This slice does not call a paid provider and does not add a paid LLM SDK. Creating a project writes onto the default page that the project already has. It does not edit some other page the user already had open.
