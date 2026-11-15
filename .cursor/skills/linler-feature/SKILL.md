---
name: linler-feature
description: >-
  Plans and implements one Linler backend slice on a feature branch.
  Use when the user adds or changes an API, billing, auth, or workspace behavior.
---

# Linler backend slice

## Boundary

This repository is the NestJS API. Screens stay in the frontend repository. Stripe secret keys, webhook signing, and subscription state stay here.

Do one slice per branch.

## Steps

1. Confirm the branch is `igor/feat/<name>`, `igor/fix/<name>`, or `igor/bug/<name>`, and that it is not `main`.
2. For work that spans several modules, write the plan first: endpoint, entity fields, and how the client will call it.
3. Implement only that slice. Follow `.cursor/rules/stack.mdc`. Put protocol strings in `src/constants` and service payload shapes in `src/types`.
4. Run `pnpm lint:check` in this session. On failure, fix it here. Do not start a subagent to run the check.
5. Ask the `reviewer` subagent to review the diff against `main` before calling the slice done.
6. Stop. Commit, push, or merge only when the user asks.

## Stop rules

- No push or commit to `main`.
- No live Stripe key. Test keys only.
- No second feature slipped into the same diff.
