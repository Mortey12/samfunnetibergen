# Skiftlista: pilot og driftsplan

Dette er planen for en måned med Skiftlista i bruk på ekte data, først på
Stjerne. Teknisk bakgrunn og kode står i
[skiftlista-leader-app.md](skiftlista-leader-app.md). Det som ikke er avgjort
står samlet nederst under «Åpne spørsmål». Ikke les noe i dette dokumentet som
vedtatt før de er besvart.

## Hva piloten er

En pilot, ikke en demo. Appen kjører mot en ekte Personal, med ekte
lederkontoer, og det som endres der ser de frivillige i mobilappen med en
gang. Demo-innloggingen skal være av: den nekter å starte så lenge det finnes
ekte personer i databasen.

**Med i piloten:** sette folk opp på skift, publisere uka, se ønskene
(«vil», «kan», «kan ikke»), bytter og sykdom (se hva som vises i uka), og last
ned en CSV av uka.

**Ikke med (ennå):** varsler til ledere om bytter og sykedager (Slack, venter
på godkjenning), påminnelse til dem som ikke har sendt ønsker, kurs og
opplæring som egne skjermer for ledere.

**Varighet:** omtrent en måned.

## Hvem deltar

- Hele Stjerne: 20–30 frivillige og leder for Stjerne. De frivillige bruker
  mobilappen, så den delen må være klar før uke 1 (se «Åpne spørsmål»).
- De andre barene (Kjøkken, Grøndahls, Halvtimen) slås på først når Stjerne
  har brukt appen noen uker uten store problemer. Hver bar har en egen bryter
  («deltar i Skiftlista») under `/shifts/settings` i Personal.
- Hver leder trenger en ekte konto med rollen Gruppeadmin knyttet til sin bar.

## Før start

Gjøres av e-tjenesten og utvikleren av Skiftlista. Ingenting av dette er gjort ennå.

1. **Sikkerhetskopi av databasen** før de syv nye migreringene kjøres.
   Migreringene er prøvd på en tom Postgres, ikke på en database med data.
2. **Klargjøringsrapport.** Den endrer ingenting og skriver bare tall, ingen
   navn. Kjøres i `kvarteret-personal` av noen med tilgang til databasen:

   ```bash
   uv run python scripts/shifts/pilot_readiness.py --bars Stjerne
   ```

   Rapporten viser OK, MISSING eller CHECK for hver bar: gruppen under
   Skjenkegruppen, bryteren, maler, genererte skift ut semesteret, stengte
   perioder, hvor mange som har verv som Skiftleder, Kokk og Opplæring, hvor
   mange kvalifikasjoner kopieringsskriptet vil lage, folk uten e-post, og
   skiftledere uten innlogging eller uten Gruppeadmin-tilgang til baren.
   Pilot kan starte når ingenting står som MISSING for Stjerne. Med
   `--strict` slutter kommandoen med feilkode når noe mangler.
3. **Kopier verv til kvalifikasjoner** (engangskjøring, tørrkjøring først):
   `scripts/shifts/copy_verv_to_qualifications.py`. Sjekklisten den skriver
   inneholder bare id-er.
4. **Demo-innloggingen er av.** Sjekk at `DEMO_LOGIN_ENABLED` ikke er slått på
   (standard er av), og at `DEMO_ACCESS_CODE` og `DEMO_APP_CODE` ikke er satt
   på den ekte serveren.
5. **Oppsett av appen:** `LEADER_APP_ORIGINS` i Personal er satt til appens
   faste HTTPS-adresse, og Vercel-prosjektet har `VITE_LEADER_API=http`,
   `VITE_APP_ENV=production` og `VITE_APP_VERSION`.
6. **«Meld feil» virker** bare når Personal har `LINEAR_API_KEY` og
   `LINEAR_TEAM_ID`. Prøv den én gang før start. Uten nøkkel står det
   «Feilmeldingen ble ikke sendt», og ingenting blir meldt.
7. **E-tjenestens gjennomgang** av sikkerhetsfunn E (noen gruppe- og
   verv-handlinger i Personal sjekker rollen, men ikke gruppa). Personvern er
   avgjort av utvikleren (kvalifikasjoner lagres for alltid, ledere ser sine
   egne frivillige), se «Åpne spørsmål».

## Prøvekjøring før uke 1

To trinn, i denne rekkefølgen. Utvikleren har valgt dette.

**Trinn A: øvelse med oppdiktede data.** Et lite møte der utvikleren og et par
ledere prøver appen sammen. Det brukes øvingsserveren med fakedata på utviklerens
egne kontoer (Render og Vercel), så ingen ekte skift eller personer berøres.
Bruk lederguiden [skiftlista-leder-guide.md](skiftlista-leder-guide.md) og
testlisten `apps/internal/skiftlista/TESTING.md`. Øvingsserveren kjører en
eldre utgave; avgjør før møtet om den skal oppdateres med rettelsene fra
denne økta (for eksempel pluss og minus på smale skjermer).

**Trinn B: Kjøkken med ekte data.** Utvikleren er medlem i Kjøkken og prøver
appen der selv. Dette er en prøve av piloten og krever det samme som piloten:
sikkerhetskopi og migreringer gjort av e-tjenesten, demo-innloggingen av,
Gruppeadmin-konto for utvikleren på Kjøkken, bryteren for Kjøkken på, og
`pilot_readiness.py --bars Kjøkken` uten MISSING (Kjøkken vurderes på Kokk, ikke
Skiftleder). Regler under prøven:

- Jobb bare på en uke langt fram og **ikke trykk «Publiser uka»**. Et utkast ser
  ingen frivillige.
- Ekte personer blir lagt inn i ekte data selv i et utkast. Ta alle av plassene
  igjen etterpå.
- Skriv ned det som er rart, og bruk «Meld feil» minst én gang for å prøve at
  meldingen kommer fram.

## Excel er sikkerhetskopien de første 2–3 ukene

Det nåværende arket (H26) holdes ved like som skrivebeskyttet kopi, og
ingenting skal bare finnes i appen i starten.

- **Hver uke** (forslag: fredag, når uka etter er publisert): lederen trykker
  «Last ned CSV» for uka på skjermen (eller «Last ned flere uker» for flere
  på en gang) og limer den inn i arkfanen «Arkiv».
  Filen bygges i nettleseren og sendes ingen steder.
- Gjør det for hver bar som er med.
- Etter 2–3 uker uten problemer avgjør de som styrer piloten om Excel kan
  slutte å oppdateres (se «Hvem bestemmer»).

## Hva vi måler

Anbefaling fra Claude, ikke avtalt. Fire tall, alle lette å få tak i, og
Utvikleren samler dem:

- **Uker planlagt og publisert i appen** (mål: alle ukene i måneden), og hvor
  mange plasser som sto ledige da uka ble publisert. Står i den ukentlige CSV-en.
- **Antall «Meld feil»** og hva de gjaldt. Står i Linear.
- **Antall ganger reserveløsningen eller Excel måtte brukes i stedet.**
  Lederen skriver det i Slack-kanalen hver gang, så det kan telles.
- **Hva lederen for Stjerne synes**, i en kort samtale etter uke 2 og ved slutten:
  går det raskere eller tregere enn arket, og hva er mest til hinder.

Antall uker endret etter publisering (gul status) er nyttig å se på, men
trenger ikke måles for å avgjøre piloten.

## Slik melder du feil

**Leder:** trykk «Meld feil» i verktøylinja, skriv hva som skjedde og hva du
ventet. Ikke skriv navn på frivillige. Meldingen blir en sak hos e-tjenesten,
merket med bar, uke og versjon. Står det «ikke sendt» i stedet for «Takk», kom
den ikke fram: skriv i den åpne Slack-kanalen for piloten, der e-tjenesten og
utvikleren følger med. Kanalen finnes ikke ennå og må opprettes.

**Uventede feil** i nettleseren sendes automatisk til Personal uten navn,
uten stack og uten hva som står i uka.

**E-tjenesten:** ser sakene i Linear (triage). Meldinger fra øvingsserveren er
merket `fake` eller `development` i tittelen.

## Ukerutine

Leder, hver uke:

1. Åpne baren og uka som skal planlegges. Se ønskene og «ledige»-tallet.
2. Sett folk opp. Bruk «Angre» ved feil. Gule og røde advarsler leses før man
   bekrefter.
3. Legg til eller ta bort plasser med pluss og minus når en dag blir travlere.
4. Publiser uka. **Frivillige ser skiftene sine med en gang** etter publisering.
5. Endres en publisert uke, blir den gul («endret etter publisering»). Trykk
   «Publiser uka» igjen når du er ferdig.
6. Last ned CSV til Excel-kopien (så lenge den gjelder).

E-tjenesten, hver uke: se på nye «Meld feil»-saker, og kjør
klargjøringsrapporten før en ny bar slås på.

## Når appen ikke virker

1. **Prøv først å laste siden på nytt.** Står det at du ikke er innlogget, bruk
   lenka til Personals innlogging.
2. **Reserveløsningen er den eldre planleggingssida i Personal, `/shifts`.**
   Den har dra-og-slipp for å sette folk opp, flytte og ta av, viser ønsker, og
   har knapper for å publisere uka eller åpne den for ønsker. Den er enklere
   enn appen. Merk: endringer gjort der gjør ikke uka gul.
   Sjekk at den fortsatt finnes i den utgaven av Personal som kjører før
   piloten starter.
3. **Excel-arket** har siste ukentlige kopi hvis begge deler er nede.
4. Meld fra til e-tjenesten, og skriv ned hva som ikke ble gjort, så det kan
   føres inn etterpå.

## Gjøre en uke til utkast (ta den bort fra de frivillige)

- I appen: «Gjør til utkast». Det spør først, og sier at frivillige ikke ser
  skiftene før uka publiseres igjen.
- På `/shifts`: «Åpne for ønsker» på uka.
- Bare kommende uker kan åpnes. Personal nekter å åpne en uke som har startet
  eller er over, og viser en tekst om det.
- Utkast kan ikke angres med Ctrl+Z, og publisering er ikke en del av
  «Angre».

## Rulle tilbake mobilappen

De frivilliges skjermer ligger i mobilappen (`kvarteret-internbevis`), som
oppdateres over luften (OTA) med arbeidsflyten «OTA update» fra `development`.

- **Raskeste stopp, uten ny oppdatering:** slå av bryteren «deltar i
  Skiftlista» for baren under `/shifts/settings`. Dette er forslaget om å
  styre skjermene fra serveren; om mobilappen faktisk skjuler skjermene når
  bryteren er av, må sjekkes før piloten.
- **Rull tilbake en OTA-oppdatering:** publiser forrige gode oppdatering på
  nytt i EAS (nettsiden eller kommandoen `eas update:republish`). Ikke prøvd
  ennå; e-tjenesten bør øve på det én gang før piloten.
- Nye native avhengigheter krever en butikkutgivelse, og det har ikke
  Skiftlista-skjermene. Hvilken byggeversjon som ligger i butikkene nå er
  ikke bekreftet.

## Hvem bestemmer å stoppe

Leder for e-tjenesten, utvikleren og leder for Stjerne kan stoppe piloten
umiddelbart. Forslag til når:

- Data er feil eller forsvunnet for de frivillige.
- Personopplysninger kom ut til noen som ikke skal se dem.
- Lederne kan ikke planlegge uka og reserveløsningen holder ikke.

Å stoppe betyr: slå av bryterne, åpne ukene for ønsker igjen om nødvendig, og
gå tilbake til Excel som hovedløsning.

## Avgjørelsen etter måneden

Behold, endre eller stopp. Et forslag til underlag: tallene under «Hva vi
måler», svarene fra lederne, og en liste over det som ble løst med
reserveløsningen eller Excel. Nye barer og nye funksjoner (varsler,
påminnelser, kurs) vurderes først etter en «behold» eller «endre».

## Besvart av utvikleren (2026-11-04)

1. **Hvem:** hele Stjerne, 20–30 frivillige.
2. **Hvilken Personal:** ja, ekte data. Ønskene må komme fra mobilappen
   utvikleren har laget, så piloten kjører mot den ekte Personal, med bare Stjerne
   slått på.
3. **Når «Meld feil» ikke virker:** e-tjenesten og utvikleren, via en åpen
   Slack-kanal.
4. **Hvem kan stoppe:** leder for e-tjenesten, utvikleren og leder for Stjerne.
6. **Personvern:** piloten er så sent i året at utgangspunktet er at alle som
   har hatt opplæringsskift regnes som godkjent for det, og for skiftleder
   spør man leder for Stjerne. (Claude: jeg leser det slik at leder for Stjerne
   gjennomgår listen over skiftledere fra kopieringsskriptet før start. Dette
   er ikke et svar fra personvernansvarlig.)
   Vedtatt: kvalifikasjoner lagres for alltid, også for folk som har sluttet.
   Ingen andre trenger å svare på det (utvikleren, 2026-11-05).
   Ledere ser sine egne frivillige (svar fra utvikleren, 2026-11-05). I koden
   er det lederens egen bar pluss de andre barene under Skjenkegruppen som har
   bryteren på, så andre barer kan låne folk. Mens bare Stjerne er med i
   piloten, ser Stjerne-lederen bare Stjernes folk. En Admin ser alle barer som
   er med. Utvikleren har en Admin-konto, så
   utviklerens egen innlogging trenger ingen ny konto. Lederne for Stjerne
   trenger fortsatt hver sin Gruppeadmin-konto.
8. **Fast adresse og Vercel-prosjekt:** Leder for e-tjenesten gjør det.

## Åpne spørsmål

5. **Hva vi måler:** anbefalingen står under «Hva vi måler». Utvikleren bekrefter.
7. **Sikkerhetsfunn E** (rett gruppe-sjekk i Personals gruppe- og verv-ruter),
   og funn A og C: avgjøres sammen med e-tjenesten.
9. **Mobilen:** hvilken byggeversjon som ligger i butikkene, og om
   mobilappen skjuler Skiftlista-skjermene når bryteren for baren er av. Dette
   blir viktigere nå som 20–30 frivillige skal bruke den: uten de nye
   skjermene ser de ikke skiftene sine. Må avklares før uke 1.
10. **Linear-nøkkelen** på serveren som brukes: ikke avklart. Uten nøkkel gir
    «Meld feil» beskjed om at meldingen ikke ble sendt, og Slack-kanalen er da
    eneste vei.
11. **Slack-kanalen** for piloten må opprettes, og lederne må få vite navnet.
