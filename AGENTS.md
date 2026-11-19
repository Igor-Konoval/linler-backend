# Linler backend

NestJS API for the Linler client: accounts, workspaces, projects, pages, and billing. The Next.js app is a separate repository.

## How to work

- Feature branches: `igor/feat/<name>`, `igor/fix/<name>`, `igor/bug/<name>`.
- This line lives on `igor/feat/stripe-billing` until it is merged. Do not push `main`. A push to `main` can deploy production.
- Do not commit or push unless the user asks.
- After a code change, run `pnpm lint:check` in this session. Run `pnpm test` when the change touches services or billing.
- Stripe secrets stay in the backend environment. Only `sk_test_` keys are allowed. Do not put them in source files.

## Where the details live

- Workflow: `.cursor/rules/workflow.mdc`
- Stack: `.cursor/rules/stack.mdc`
- Feature procedure: `.cursor/skills/linler-feature/SKILL.md`
- Review before a merge: `.cursor/agents/reviewer.md`
- Shell gate against pushing `main`: `.cursor/hooks.json`
