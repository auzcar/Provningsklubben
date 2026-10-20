# Inloggning, medlemmar och profiler

## Hur det fungerar

- All behörighet avgörs på servern i `lib/auth.ts`. Varje API-anrop verifierar identiteten och att personen är aktiv medlem.
- `AUTH_MODE=clerk`: servern verifierar Clerks sessionstoken (`Authorization: Bearer` eller cookien `__session`): signatur, giltighetstid och att den utfärdats för appens egen adress. Identitetshuvuden från klienten ignoreras helt.
- Utan `AUTH_MODE=clerk` gäller det ursprungliga Sites-läget: `oai-authenticated-user-*`-huvuden från Sites-gatewayen. Det används av nuvarande produktion och av den lokala testinloggningen på loopback. Exponera aldrig en Worker i det läget utan en gateway som rensar sådana huvuden.
- Första gången en verifierad användare anropar API:t skapas en rad i `profiles`. Namn och verifierad e-post hämtas från Clerk.
- Administratörer: e-postadresserna i `ADMIN_EMAILS` är alltid administratörer. En administratör kan dessutom göra andra medlemmar till administratörer i appen.
- Inaktiverade medlemmar stoppas i varje API-anrop, även om de har kvar en giltig inloggning eller en inbjudningslänk till en provning.
- Värdskap gäller fortfarande per provning (`tastings.owner`). En delad provningslänk ger ingen åtkomst utan inloggat medlemskonto.

## Profiler

- Namn, beskrivning och profilbild. Bilden beskärs och förminskas i webbläsaren och lagras i D1-tabellen `avatars` (högst 300 kB, JPEG/PNG/WebP, kontrolleras på servern). Bilden visas bara för inloggade medlemmar.
- Profilen visar provningar och betyg från **avslöjade** provningar och från det importerade arkivet. Betyg i pågående provningar visas aldrig, inte heller på den egna profilen.
- Det importerade arkivet innehåller bara deltagarnamn, inga konton. Administratören kopplar arkivnamn till en medlem under Medlemmar → Koppla arkivnamn.

## Testläge för administratören

Under Medlemmar kan en administratör starta testläget. Då skapas fyra påhittade medlemmar (`test:host`, `test:1`–`test:3`) och administratören kan använda appen som någon av dem, som värd eller deltagare och utan adminbehörighet. Varje flik minns sin egen testperson, så flera vyer kan visas samtidigt på en enhet.

- Webbläsaren skickar huvudet `X-Test-User`. Servern godtar det bara när den verifierade inloggningen tillhör en administratör och bara för id som börjar med `test:`. Det går alltså inte att agera som en riktig medlem eller få adminbehörighet den vägen. En inloggning vars eget id börjar med `test:` avvisas.
- Testprovningar och riktiga provningar delar aldrig deltagare: testpersoner kan inte bjudas in till eller ansluta till riktiga provningar och tvärtom.
- Testprovningar visas inte i det riktiga arkivet, statistiken eller medlemslistan. Testpersonerna ser bara varandra.
- Värden i en pågående testprovning kan fylla i slumpbetyg åt testdeltagarna. "Rensa testdata" tar bort testpersoner, testprovningar, deras betyg och profilbilder.

## Sätta upp Clerk (görs av ägaren)

1. Skapa en applikation på clerk.com. Aktivera e-post som inloggningsmetod.
2. Under **Configure → Restrictions** väljer du **Restricted** som sign-up mode. Då kan bara inbjudna skapa konto.
3. Lokalt: kopiera `.dev.vars.example` till `.dev.vars` och fyll i nycklarna från utvecklingsinstansen, `AUTH_MODE=clerk` och din e-post i `ADMIN_EMAILS`. Kör `pnpm dev`.
4. Logga in. Bjud in medlemmar under Medlemmar. De får ett mejl, skapar konto via länken och landar i klubben.

## Egen Cloudflare-produktion (inte gjord, kräver separat godkännande)

1. `cloudflare.deploy.json` anger Worker-namn, D1-databas och `AUTH_MODE=clerk` (inget av det är hemligt). Inställningarna gäller bara `pnpm build`; `pnpm dev` använder fortfarande den lokala databasen och testinloggningen. Eftersom `AUTH_MODE=clerk` byggs in litar den driftsatta Workern aldrig på identitetshuvuden, inte ens innan nycklarna är inlagda. Koppla repot i Cloudflare (Workers Builds) med byggkommandot `pnpm build` och deploy-kommandot `pnpm run deploy:cloudflare`, som först kör migrationerna i `drizzle/` mot databasen.
2. Skapa en Clerk-produktionsinstans för den egna domänen och lägg till DNS-posterna som Clerk anger.
3. Sätt `CLERK_PUBLISHABLE_KEY` och `ADMIN_EMAILS` som variabler och `CLERK_SECRET_KEY` som hemlighet (`wrangler secret put CLERK_SECRET_KEY`). Valfritt: `CLERK_JWT_KEY` för verifiering utan nätverksanrop.
4. Flytta data först efter en fullständig produktionsexport (se `docs/DATA.md`). Befintliga `tastings.owner` och `members.user` är Sites-användar-id och måste mappas till Clerk-id enligt en uttrycklig plan.

Nycklar och hemligheter läggs aldrig i Git.
