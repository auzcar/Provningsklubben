# Data preservation and restore

## Production location

Current production: https://provningsklubben.oakenalder512.chatgpt.site, Sites project `appgprj_6ad61b0b78e48191b4d852099c5b3f8a`. Data is stored in the managed Cloudflare D1 binding `DB`.

Read-only inspection on 2026-10-19 found `historical` (35 rows), `tastings` (1), `members` (0), `ratings` (0). There is no R2 binding or profile/avatar table in this version. Historical ratings are nested in `historical.data`, not in `ratings`. The bundled source history contains 35 sessions, 197 samples and 855 ratings. External product-image URLs remain external URLs; they are not local image files.

## What the separate private package contains

- `history.json`: byte-for-byte original history from the source version.
- Original spreadsheet extracts, metadata and original importer.
- `original-source.tar.gz`: original tracked source snapshot, including personal seed data, without its Git history.
- `database-readback.json`: all pages returned by the read-only live database tool, with truncation metadata.
- `recovery-data.json`: exact readable live rows for tastings/members/ratings and source-file historical data.

The live database viewer truncates large values: 27 of 35 historical records could not be read completely. Eight complete records matched the source history. Therefore recovery-data.json is a recoverable dataset, NOT a verified full snapshot of current production. No production rows were changed, and no live historical value was silently substituted without this disclosure. The readback is paginated, not a transactionally consistent snapshot. Obtain a full export from the Sites database administration/support route before migrating production. Available tools did not expose that full-export operation.

## Restore into a new local database

Keep the private files outside the repository. Run from the code directory:

```sh
pnpm db:migrate:local
python3 scripts/recovery-to-sql.py /absolute/private/recovery-data.json /absolute/private/recovery.sql
pnpm db:restore:local -- /absolute/private/recovery.sql
```

The converter refuses an existing output file. Generated SQL refuses nonempty application tables and uses INSERT, never DELETE, UPDATE, REPLACE or UPSERT. A failed restore must be investigated; use a separate fresh development checkout for retries. Never use production credentials or add `--remote` to these local commands. Owner IDs are preserved; a local test user does not automatically own a restored production draft. Do not rewrite IDs without an explicit mapping plan.

Export your own local database to a new private path:

```sh
pnpm db:export:local -- /absolute/private/local-backup.sql
```

Protect these exports with restricted permissions and encrypted storage. They include participant records and invitation tokens. Never commit them, place them in public assets, or attach them to PRs. Retain original exports before any restore. `.gitignore` is a precaution, not a substitute for reviewing staged content.

## Independent Cloudflare database

After provisioning your own database, use a separate deployment configuration with the actual account/database ID, obtain a restricted Cloudflare credential, and apply the unchanged migrations there. Cloudflare credentials for a new account do not grant access to the Work-managed database. Export/restore against remote production is a separate approved operation. A full production export and an authentication/user-ID migration are prerequisites for cutover.

## Import into the own Cloudflare deployment

Signed in as administrator, open Medlemmar → Importera historik and choose the private `recovery-data.json` (format 1) or `history.json`. The file goes straight to the app's D1 database via `/api/import` (`lib/import.ts`); it never passes through Git. Only missing rows are inserted (`INSERT OR IGNORE`), so a repeated import changes nothing. Sites user ids cannot sign in here, so imported tastings get the importing administrator as host. Afterwards, link archive names to members under Koppla arkivnamn.

## Backups of the own Cloudflare deployment

Three layers, from short to long term:

1. **D1 Time Travel** (automatic, nothing to configure): Cloudflare keeps a point-in-time history of the `provningsklubben` database, 7 days on the Workers Free plan and 30 days on Workers Paid. Restore with `wrangler d1 time-travel restore provningsklubben --timestamp=<ISO time>` (this overwrites the live database; export first).
2. **Weekly automatic backup** (`lib/backup.ts`, `scheduled` in `build/sites-worker.ts`): when `cloudflare.deploy.json` has `"backups": {"kv_namespace_id": "<id>", "cron": "17 3 * * 1"}`, the Worker stores a full JSON backup in the KV namespace bound as `BACKUPS` every Monday and keeps each for twelve weeks. Create the namespace first (Cloudflare dashboard → Storage & Databases → KV), otherwise the deploy fails. The namespace id is not secret.
3. **Download** (admin, Medlemmar → Säkerhetskopior): a full backup (format 2: every table and column, including profiles, avatars and shopping lists) or one of the weekly ones. Keep it private and outside Git; it contains personal data and invitation tokens.

Restore a format 2 file with Medlemmar → Importera historik. It inserts missing rows only (`INSERT OR IGNORE`), keeps original owners and never overwrites existing rows.
