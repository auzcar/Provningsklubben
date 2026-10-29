# Inloggning, medlemmar och profiler

## Hur det fungerar

- All behörighet avgörs på servern i `lib/auth.ts`. Varje API-anrop verifierar identiteten och att personen är aktiv medlem.
- `AUTH_MODE=clerk`: servern verifierar Clerks sessionstoken (`Authorization: Bearer` eller cookien `__session`): signatur, giltighetstid och att den utfärdats för appens egen adress. Identitetshuvuden från klienten ignoreras helt.
- Utan `AUTH_MODE=clerk` gäller det ursprungliga Sites-läget: `oai-authenticated-user-*`-huvuden från Sites-gatewayen. Det används av nuvarande produktion och av den lokala testinloggningen på loopback. Exponera aldrig en Worker i det läget utan en gateway som rensar sådana huvuden.
- Första gången en verifierad användare anropar API:t skapas en rad i `profiles`. Namn och verifierad e-post hämtas från Clerk.
- Administratörer: e-postadresserna i `ADMIN_EMAILS` är alltid administratörer. En administratör kan dessutom göra andra medlemmar till administratörer i appen.
- Inaktiverade medlemmar stoppas i varje API-anrop, även om de har kvar en giltig inloggning eller en inbjudningslänk till en provning.
- Värdskap gäller fortfarande per provning (`tastings.owner`). En delad provningslänk ger ingen åtkomst utan inloggat medlemskonto.
- Pågående provning låser: den som är värd för eller har anslutit till en pågående provning får bara svar som rör den provningen (provningen, listan över provningar, medlemmar och profilbilder för bordet) tills resultatet avslöjats. Allt annat, som arkiv, statistik, profiler och andra provningar, svarar 423 oavsett enhet eller webbläsare. Kontrollen sitter i `requireMember`/`requireAdmin` i `lib/auth.ts`; rutter som provningen behöver anger `{duringTasting:true}`. En provning som lämnats öppen sedan före i går (svenskt datum) låser inte, och värden kan avbryta provningen från värdpanelen.
- Undantag, godkänt av ägaren 2026-10-27: kalenderprenumerationen (`app/api/calendar`). Kalenderappar kan inte logga in, så flödet nås med en hemlig, slumpad token per medlem (tabellen `calendar_feeds`, 48 hexadecimala tecken). Flödet visar bara titel, datum, tid, plats, tema och värd för provningar där medlemmen är värd, deltar eller är inbjuden, aldrig drycker eller betyg. Inaktiverade medlemmars länkar slutar fungera, och medlemmen kan byta token under Profil → Kalender. I Sites-gatewayläget kräver gatewayen inloggning för alla adresser, så prenumerationen fungerar bara i Clerk-läget.

## Väntrum

Under Medlemmar → Väntrum kan en administratör sätta på väntrummet för att bjuda in medlemmar i förväg utan att släppa in dem. Medan det är på ser alla som inte är administratörer bara en väntsida: profilbilden för administratören som satte på det, texten "Den som väntar på nåt gott väntar aldrig för länge!" och ordmärket med EST. 2019 i en toppbanner som i appen. Spärren sitter på servern i `requireMember`/`requireAdmin` (`lib/auth.ts`): alla andra API-anrop svarar 403, och `/api/avatar` lämnar bara ut den administratörens bild. Testpersoner i testläget påverkas inte. Inställningen ligger i tabellen `settings` (nyckeln `waiting_room`, värdet är administratörens id). "Öppna klubben" tar bort den.

## Profiler

- Namn, beskrivning och profilbild. Medlemmen flyttar, zoomar och centrerar bilden i en bildredigerare (`app/photo-crop.tsx`, även under Förbered medlemmar). Bilden beskärs och förminskas i webbläsaren och lagras i D1-tabellen `avatars` (högst 300 kB, JPEG/PNG/WebP, kontrolleras på servern). Bilden visas bara för inloggade medlemmar.
- Profilen visar provningar och betyg från **avslöjade** provningar och från det importerade arkivet. Betyg i pågående provningar visas aldrig, inte heller på den egna profilen.
- Det importerade arkivet innehåller bara deltagarnamn, inga konton. Administratören kopplar arkivnamn till en medlem under Medlemmar → Koppla arkivnamn.

## Förbered medlemmar

Under Medlemmar → Förbered medlemmar kan en administratör lägga in namn, profilbild och arkivnamn för en vän innan hen har ett konto. Inget skickas ut förrän administratören trycker Bjud in på den förberedda medlemmen (Clerk-läget), som skickar samma inbjudan som Medlemmar → Bjud in en medlem. Har adressen redan en väntande inbjudan står det Inbjuden i stället. Förberedelsen kopplas till e-postadressen och används en gång, när en ny profil skapas för en inloggning med samma e-postadress. I Clerk-läget krävs att e-postadressen är verifierad. Därefter tas förberedelsen bort. Den går inte att göra för en e-postadress som redan tillhör en medlem.

## Testläge för administratören

Under Medlemmar kan en administratör starta testläget. Då skapas fyra påhittade medlemmar (`test:host`, `test:1`–`test:3`) och administratören kan använda appen som någon av dem, som värd eller deltagare och utan adminbehörighet. Varje flik minns sin egen testperson, så flera vyer kan visas samtidigt på en enhet.

- Webbläsaren skickar huvudet `X-Test-User`. Servern godtar det bara när den verifierade inloggningen tillhör en administratör och bara för id som börjar med `test:`. Det går alltså inte att agera som en riktig medlem eller få adminbehörighet den vägen. En inloggning vars eget id börjar med `test:` avvisas.
- Testprovningar och riktiga provningar delar aldrig deltagare: testpersoner kan inte bjudas in till eller ansluta till riktiga provningar och tvärtom.
- Testprovningar visas inte i det riktiga arkivet, statistiken eller medlemslistan. Testpersonerna ser bara varandra.
- Värden i en pågående testprovning kan fylla i slumpbetyg åt testdeltagarna. "Rensa testdata" tar bort testpersoner, testprovningar, deras betyg och profilbilder.
- Provkör en riktig planering: under Planering → Översikt kan administratören kopiera sin egen provning till en testprovning ("Provkör i testläget"). Kopian får Testvärden som värd och alla testpersoner som inbjudna, och öppnas i samma flik som Testvärden. Originalet påverkas inte, och kopian försvinner med Rensa testdata.

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
