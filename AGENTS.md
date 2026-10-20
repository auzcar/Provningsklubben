# Provningsklubben – projektregler för alla AI-verktyg

Det här är webbsidan för Provningsklubben (dryckesklubb). Samma regler gäller oavsett verktyg:
Claude, Claude Code, ChatGPT/Codex, Gemini och Antigravity.

## Projektet
- Webbsida för Provningsklubben. Koden påbörjades i ChatGPT Sites och förs över hit.
- Teknikstack: React 19, TypeScript, Vinext/Vite, Tailwind CSS, Cloudflare Workers/D1 och Drizzle.
- Gränssnitt: `app/club.tsx` (provningsläget i `app/tasting-mode.tsx`, avslöjandet i `app/results.tsx`, statistiken i `app/stats.tsx` med prisanalysen i `lib/stats-math.ts`, Swish i `app/swish.tsx`, inköpslistan i `app/shopping-list.tsx`, arkivredigering för admin i `app/archive-edit.tsx`, kalenderfil i `lib/calendar.ts`; appikon och manifest i `public/`), styling: `app/globals.css` (stilen "mellanläget" ligger sist i filen; ljus variant under `[data-theme=light]`, växlas i `app/theme-toggle.tsx`), API: `app/api/`.
- Validering och blindning: `lib/model.ts`. Dryckeskategorier: `lib/drink-categories.ts`.
- Inloggning och medlemskap: `lib/auth.ts` (Clerk eller Sites-gateway, styrs av `AUTH_MODE`). Profiler: `lib/profiles.ts`, `app/profile.tsx` (alla betyg och egen inköpslista i `app/my-ratings.tsx`), `app/members.tsx`. Testläge för admin: `lib/test-users.ts`, `app/test-mode.tsx`. Se `docs/AUTH.md`.
- Schema: `db/`. Migrationer: `drizzle/`. Resurser: `public/` och `vendor/`.
- `build/` innehåller underhållen källkod. Genererat byggresultat ligger i `dist/`.
- Installation: Node.js 24 och pnpm 11.25.0, sedan `pnpm install --frozen-lockfile`.
- Lokal databas: `pnpm db:migrate:local`. Utveckling: `pnpm dev`.
- Kontroller: `pnpm test`, `pnpm typecheck` och `pnpm build`.
- Data och exportbegränsningar: `docs/DATA.md` och `docs/VERIFICATION.md`. Säkerhetskopior: `lib/backup.ts`, `app/api/backup/` och veckojobbet i `build/sites-worker.ts` (se `docs/DATA.md`).
- Språk i sidans innehåll: svenska, om inget annat sägs.

## Arbetsregler
- Repot på GitHub är enda sanningen. Arbeta aldrig mot en kopia som inte är synkad.
- Kör `git pull` innan du börjar och `git push` när du är klar.
- Jobba på en egen gren per verktyg: `claude/<ämne>`, `codex/<ämne>`, `gemini/<ämne>`. Slå ihop till `main` via pull request.
- Små, avgränsade commits med tydligt meddelande.
- Ändra inte filer som inte hör till uppgiften.
- Skriv aldrig lösenord, API-nycklar eller tokens i repot.

## Håll det här aktuellt
- Ändras teknikstack, mappstruktur eller byggkommandon: uppdatera avsnittet "Projektet" ovan.
- `CLAUDE.md` och `GEMINI.md` pekar hit. Lägg ingen regel bara i dem.

## Bevara funktion och data
- Behåll design, API-kontrakt och arkitektur om uppgiften inte kräver annat.
- Lägg till nya migrationer; ändra aldrig redan tillämpade migrationer.
- Persondata och databasexporter hålls utanför Git. Privat återställningsunderlag levereras separat.
- Bevara blindning, värdbehörighet, versionskontroll av utkast och låsta betyg efter avslöjande.
- Avslöja först när alla anslutna deltagare betygsatt eller avstått på alla prov och antalet planerade deltagare har anslutit.
- Ändra inte produktionsmiljö, databas eller autentisering utan uttryckligt godkännande.
- Extern produktion kräver en verifierad autentiseringslösning. Lita aldrig på identitetshuvuden från klienten; lokal testinloggning är endast för utveckling på loopback.
- Använd en separat worktree per aktiv agent. Kör kontrollerna ovan före pull request.
- Produktionen körs på Cloudflare med Clerk-inloggning, profilsidor och profilbilder. Historiska provningar visas under Provningar → Tidigare provningar (`app/archive-tasting.tsx`, endast läsning).
- Avslöjade provningar kan bara tas bort av en administratör som skriver provningens namn för att bekräfta.
