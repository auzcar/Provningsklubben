# Dryckesklubben (Provningsklubben)

Export of the existing Sites application, not a reimplementation. Baseline: source commit `77f32abe31c250eaeaad35270b7ca9a541b0f47f`, saved Site version 3, inspected 2026-10-19. Production has not been changed.

## Features and architecture

Host planning, budget and shopping status; blind tasting with individual mobile ratings; server-side reveal gating; searchable history with drink categories and beer subgroups; Systembolaget article lookup with fallback and manual entry. React 19 + TypeScript, Vinext/Vite with Next-compatible routing, Tailwind CSS, Cloudflare Workers and SQLite-compatible D1. Drizzle owns schema/migrations. Existing UI and business logic are retained.

The exported version had no profile pages or avatar uploads. They are added on top of the export, together with invite-only Clerk sign-in and server-side membership checks; see [docs/AUTH.md](docs/AUTH.md). They are not in production. Dedicated historical tasting pages still do not exist.

## Ubuntu setup

Install Git, Python 3 and Node.js 24 LTS using your usual trusted installer, then install the pinned package manager:

```sh
npm install --global pnpm@11.25.0
git clone https://github.com/auzcar/Provningsklubben.git
cd Provningsklubben
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm db:migrate:local
pnpm dev
```

The existing repository is the source of truth. This export is prepared on `codex/export-sites` based on its current `main`; existing agent rules are preserved. Until the branch is pushed and merged, `main` does not contain the application. The owner approved public repository visibility on 2026-10-19. Personal data and backups remain outside Git.

Open `http://localhost:5173`. The existing development-only sign-in route `/signin-with-chatgpt?return_to=/` creates the local test user. It works only on loopback and does not use a Work account. This is not production authentication or a multi-user mobile deployment. Local D1 data persists in ignored `.wrangler/state/`.

Copy `.dev.vars.example` to `.dev.vars` to make the local test user an administrator, or to test Clerk sign-in with a development instance. No application secret is needed for the default local sign-in. `.env.example` documents optional runtime switches. The `DB` binding is configured in `wrangler.local.json` and `vite.config.ts`, not via a database connection URL. Product lookup uses public HTTP sources without an API key. Connector infrastructure is retained from the original starter but this application does not require a connected app at runtime.

## Data

The Git copy starts with an empty history seed. Participant data, original spreadsheet extracts and the original importer are supplied separately in a private backup, not in Git. Import instructions and the limitations of the production readback are in [docs/DATA.md](docs/DATA.md). Do not copy the private backup into the repository.

## Build and verification

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

`start` runs the built Worker locally, without simulated sign-in; use `dev` for interactive local authentication. Read [docs/VERIFICATION.md](docs/VERIFICATION.md) for actual checks and remaining gaps. Product tests are fixture-based and do not guarantee current availability of upstream services. Optional private historical regression checks:

```sh
HISTORY_FILE=/absolute/private/path/history.json pnpm test
```

## Deployment and independence

Local development and builds use the bundled toolchain and local D1, without ChatGPT Work. Existing production uses Work's Sites gateway, authentication and managed Cloudflare D1. Keep that deployment untouched during the export.

For independent production, provision your own Cloudflare Worker/D1 and deploy configuration using the same `DB` binding. Apply schema migrations to the new database and restore a verified private export. Before public deployment, implement or configure a trusted authentication gateway that strips user-supplied `oai-authenticated-user-*` headers and supplies verified identities. Preserve or explicitly map existing owner/member user IDs. The existing sign-in/sign-out/callback paths are gateway-owned; they are not an independent authentication server. This is a security-sensitive migration requiring a separate approved task. Do not expose the raw Worker as a public application. A drop-in external connection to Work-managed D1 has not been provided or verified.

There is deliberately no automatic deployment workflow. Existing Sites deployment requires the original Sites tooling and ownership; the retained hosting identity is not a Cloudflare deployment credential. Do not run deployment commands against production while exporting.

## Shared development

Read [AGENTS.md](AGENTS.md). Use `main` as the stable branch, one feature branch/worktree per agent, and pull requests. Claude Code reads `CLAUDE.md`, which points to the shared rules. Give Codex and Antigravity `AGENTS.md` as their entry point. `.github/workflows/checks.yml` checks tests, type checking, builds and fresh migrations. Configure GitHub branch protection to require this workflow and review after the repository exists; no branch-protection change has yet been made.

## Repository status

Target: https://github.com/auzcar/Provningsklubben. Existing main and agent files were fetched before preparing the export branch. CLAUDE.md and GEMINI.md remain unchanged; shared rules and architecture are maintained in the existing AGENTS.md. No new repository or unrelated root history is used.

The owner approved public visibility. The export uses codex/export-sites and a pull request into main without rewriting existing history.
