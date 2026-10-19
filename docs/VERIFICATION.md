# Export verification, 2026-10-19

## Completed

- Retrieved original source repository at `77f32abe31c250eaeaad35270b7ca9a541b0f47f`, matching saved Site version 3.
- Original route tests passed, including 35/197/855 private-history regression assertions and distinct gin serving modes.
- Clean export dependency installation passed with 640 packages reused from the environment cache, zero downloaded. This verifies installation into an empty node_modules directory, not availability from the public npm registry on a fresh Ubuntu machine.
- Sanitized export tests and TypeScript check passed.
- Portable-profile production build passed on Linux with Node 24.19.0 and pinned dependencies.
- Both original migrations applied successfully to an empty local D1 database.
- Recovery dataset restored into that local D1: 35 historical sessions, 197 samples, 855 historical ratings, one current tasting, no members or current ratings; SQLite integrity_check returned ok.

- Local D1 SQL export succeeded and was restored independently into a fresh SQLite database.
- A repeated recovery import was refused by the empty-database guard; all application rows remained identical.
- The newly initialized main history was scanned for common private-key, GitHub token, OpenAI key, AWS key and hardcoded-secret patterns. No matches were found. This is a bounded pattern check, not a guarantee against every possible secret format.

## Source handling

All tracked original files are represented in either the code export or the separate private original-source archive. The original Sites Git history is not imported into the new repository, because it contains personal seed data, source extracts and build archives. No changes were pushed to Sites and no production deployment was performed.

The Git candidate retains the frontend, API handlers, styles, components, public assets, vendored source/licences, schema/migrations, fixtures, lockfile and tooling. The history import now points to a typed empty seed; historical data is restored to D1 separately. A UI placeholder with real first names was replaced by generic participant labels. The original private spreadsheet importer remains in the private package. Historical assertions in the public test suite require optional HISTORY_FILE; original assertions were tested with the private data. Added docs, local data tools and CI do not alter production.

## Remaining limitations

- GitHub push and branch protection are pending. The target is the existing auzcar/Provningsklubben, as clarified by the owner. The repository was cloned and pulled; export is prepared on codex/export-sites from existing main. The owner subsequently approved public visibility; private datasets remain excluded. Existing CLAUDE.md and GEMINI.md are unchanged; existing AGENTS.md is extended rather than replaced.
- Complete production database export is not verified: live historical values were truncated by the readback tool. Recovery history is the original bundled source dataset, not a guaranteed current live snapshot. See DATA.md.
- Independent production authentication and a new externally accessible database are not configured. Work-managed D1 is not exposed as an external connection string.
- Browser/mobile UI QA and full end-to-end sign-in in a running local dev server were not performed.
- Live Systembolaget availability was not retested; product fixture tests passed.
- GitHub Actions has not run on GitHub.
- Profiles, avatar uploads and individual historical tasting pages are absent from the recovered implementation.

Do not claim a complete migration or production cutover based on these checks. The running original remains the production system.

# Inloggning, medlemmar och profiler, 2026-10-19

Verifierat lokalt: `pnpm test` (inklusive `scripts/test-members.mjs`), `pnpm typecheck`, `pnpm build` och migrationen `0002` mot en tom lokal D1. Testerna täcker Clerk-tokenverifiering med lokalt signerade nycklar (giltig token, fel ursprung, utgången och manipulerad token, ignorerade identitetshuvuden), administratörsregler, inaktivering, att profiler inte visar betyg före avslöjande, koppling av arkivnamn och validering av profilbilder. Gränssnittet för profil och medlemmar provkördes i Chromium på desktop och mobil med den lokala testinloggningen.

Inte verifierat: inloggning mot en riktig Clerk-instans (inga nycklar finns i projektet), Clerks inbjudningsmejl och registrering via inbjudningslänk, samt drift i egen Cloudflare-miljö.
