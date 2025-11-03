31.10.2025

# Kokonaisvaltainen refaktorointi ja sivujen toteutus

## Yleiskuvaus

Refaktoroidaan sovellus kerrosarkkitehtuurin mukaiseksi, toteutetaan kaikki puuttuvat valikon sivut, parannetaan cache- ja tietokantatoteutusta, ja vähennetään koodin toistumista.

## 1. Arkkitehtuurin refaktorointi

### 1.1 Pilkotaan server.js kerrosarkkitehtuuriksi

**Tiedostot:**

- `src/app/routes/` - Reitit eri tiedostoihin (dashboard.js, repositories.js, commits.js, jne.)
- `src/app/controllers/` - Kontrollerit joka reitille
- `src/domain/services/` - Liiketoimintalogiikka
- `src/data/repositories/` - Tietokanta-operaatiot
- `src/integrations/github/` - Parannetaan olemassa olevaa

**Muutokset:**

- Siirretään reitit `server.js`:stä `routes/`-kansioon
- Eriytetään kontrollerit, palvelut ja repositoryt
- Yhtenäistetään virheenkäsittely `core/errors`-kerroksella

### 1.2 Näkymäkomponenttien refaktorointi

**Tiedostot:**

- `views/layouts/base.ejs` - Yhteinen layout (head, scripts)
- `views/components/header.ejs` - Yhteinen otsikko
- `views/components/stats-card.ejs` - Uudelleenkäytettävä stats-kortti
- `views/components/data-table.ejs` - Uudelleenkäytettävä taulukko

**Muutokset:**

- Siirretään toistuva head-koodi `base.ejs`-layoutiin
- Luodaan uudelleenkäytettäviä komponentteja
- Yhdenmukaistetaan kaikki näkymät saman layoutin käyttöön

## 2. Puuttuvien sivujen toteutus

### 2.1 Commits-sivu (`/commits`)

**Sisältö:**

- Commit-tilastot organisaatiosta (viimeisimmät commitit)
- Reposiittokohtaiset commit-tilastot
- Aktiivisuusgraafit (commits ajassa)
- Top committerit
- Commit-viestien analyysi

**Toteutus:**

- `src/app/routes/commits.js` - Reitti
- `src/app/controllers/commitsController.js` - Kontrolleri
- `src/domain/services/commitsService.js` - Palvelu
- `views/commits.ejs` - Täydellinen näkymä tilastoilla ja taulukoilla

### 2.2 Teams-sivu (`/teams`)

**Sisältö:**

- Organisaation tiimit
- Tiimien jäsenten luettelo
- Tiimien repository-kytkennät
- Tiimien aktiivisuustilastot

**Toteutus:**

- `src/app/routes/teams.js` - Reitti
- `src/app/controllers/teamsController.js` - Kontrolleri
- `src/domain/services/teamsService.js` - Palvelu
- `views/teams.ejs` - Täydellinen näkymä tiimien tiedoilla

### 2.3 Collaborators-sivu (`/collaborators`)

**Sisältö:**

- Repository-kohtaiset collaboratorit
- External collaboratorit
- Collaboratorien oikeudet ja roolit
- Collaboratorien aktiivisuustilastot

**Toteutus:**

- `src/app/routes/collaborators.js` - Reitti
- `src/app/controllers/collaboratorsController.js` - Kontrolleri
- `src/domain/services/collaboratorsService.js` - Palvelu
- `views/collaborators.ejs` - Täydellinen näkymä collaborator-tiedoilla

### 2.4 Parannetaan olemassa olevia sivuja

**Repositories-sivu:**

- Lisätään parempi suodatus ja järjestely
- Lisätään pagination
- Lisätään lisätiedot (stars, forks, issues)

**Branches-sivu:**

- Parannetaan suorituskykyä
- Lisätään branch-suojaus-tiedot
- Lisätään branch-verrattavuus

**Issues-sivu:**

- Lisätään issue-tilastot
- Lisätään issue-tyyppien jakautuma
- Lisätään issue-prioriteetti

**Pull Requests-sivu:**

- Lisätään PR-tilastot
- Lisätään PR-review-tiedot
- Lisätään merge-statistiikat

## 3. Cache- ja tietokantaparannukset

### 3.1 Cache-strategian parannus

**Muutokset:**

- Lisätään Redis-tuki (vapaaehtoinen, fallback SQLiteen)
- Parannetaan cache-invalidointia
- Lisätään cache-statistiikka ja monitoring
- Lisätään cache-ttl konfiguroitavaksi

**Tiedostot:**

- `src/integrations/cache/redisCache.js` - Redis-toteutus
- `src/integrations/cache/cacheManager.js` - Unified cache interface
- Parannetaan `src/integrations/cache/memoryCache.js`

### 3.2 Tietokantaparannukset

**Muutokset:**

- Lisätään migraatiojärjestelmä
- Parannetaan tietokantaindeksointia
- Lisätään tietokantayhteyden pooling
- Lisätään tietokantaan virheenkäsittely ja retry-logiikka

**Tiedostot:**

- `src/data/migrations/` - Migraatiot
- `src/data/models/` - Tietokantamallit
- Parannetaan `src/data/repositories/`

## 4. Koodin laadun parannukset

### 4.1 Yhtenäistäminen ja siistiminen

**Muutokset:**

- Poistetaan koodin toistumista
- Yhdenmukaistetaan virheenkäsittely
- Lisätään JSDoc-dokumentaatio
- Parannetaan logging-yhtenäisyyttä

### 4.2 Suorituskyvyn parannukset

**Muutokset:**

- Optimoidaan GitHub API -kutsut (batch-processing)
- Lisätään paralelliset kutsut missä mahdollista
- Parannetaan rate limiting -logiikkaa
- Lisätään request-deduplication

## 5. Testaus ja laadunvarmistus

### 5.1 Testien lisäys

**Muutokset:**

- Lisätään yksikkötestit palveluille
- Lisätään integraatiotestit reiteille
- Lisätään testikattavuusraportit

**Tiedostot:**

- `tests/unit/` - Yksikkötestit
- `tests/integration/` - Integraatiotestit
- `tests/fixtures/` - Testidata

## 6. Dokumentaation päivitys

**Muutokset:**

- Päivitetään README.md
- Päivitetään ARCHITECTURE.md
- Lisätään API-dokumentaatio
- Lisätään kehitysoppaat

## Toteutusjärjestys

1. **Vaihe 1:** Arkkitehtuurin refaktorointi (routes, controllers, services)
2. **Vaihe 2:** Näkymäkomponenttien refaktorointi ja yhteiset layoutit
3. **Vaihe 3:** Puuttuvien sivujen toteutus (Commits, Teams, Collaborators)
4. **Vaihe 4:** Olemassa olevien sivujen parannukset
5. **Vaihe 5:** Cache- ja tietokantaparannukset
6. **Vaihe 6:** Testien lisäys ja dokumentaation päivitys



27.10.2025

### Korkean tason tavoite
- **Tee rakenteesta kerroksittainen, testattava ja laajennettava**, poista “jumbo” `server.js` -tiedoston riskit, ja lisää näkyvyys, turva sekä CI/CD.

### Arkkitehtuurin periaatteet
- **Layered architecture**: `routes` → `controllers` → `services` → `repositories` → `integrations` → `core/utils`.
- **Dependency inversion**: palvelut eivät tunne HTTP:tä tai EJS:ää; kontrollereissa HTTP, palveluissa liiketoimintalogiikka, repoissa tietolähteet.
- **Kuvaa rajapinnat** (TypeScript-tyypeillä tai JSDoc): selkeä sopimus kerrosten välillä.
- **Idempotentti & puhdas logiikka**: sivuvaikutukset abstrahoitu integraatiokerrokseen (GitHub API, DB, tiedosto, välimuisti).

### Kansiostrategia (esimerkki)
```
/src
  /app
    /routes
    /controllers
    /middlewares
    /views (tai /templates)
  /domain
    /services
    /entities
    /usecases
  /data
    /repositories
    /migrations
    /models
  /integrations
    /github
    /cache
    /queue
  /core
    /config
    /logging
    /errors
    /utils
```

### Teknologiset parannukset
- **TypeScript**: parantaa laatu- ja muutosturvallisuutta, erityisesti API- ja DTO-tyypit.
- **Konfiguraatio**: `core/config` (dotenv, schema-validointi esim. Zod/Yup). Erota envit (dev/stage/prod).
- **Virheenkäsittely**: yhtenäinen `AppError`, virheiden mapitus HTTP-statuksiin, globaali error middleware, structured logging (pino/winston) korrelaatio-ID:llä.
- **Validointi**: request-validaatio middlewaressa (celebrate/Joi/zod), output-skeemat.
- **OpenAPI/Swagger**: generoi ja julkaise `/docs`, tue sopimustestausta.
- **Tietokanta**: siirry ORM:ään (Prisma/TypeORM/Drizzle), lisää migraatiot, indeksit, transaktiot.
- **Välimuisti**: Redis kerros GitHub API -kutsujen ja raskaan aggregoinnin eteen TTL:llä ja invalidointistrategialla.
- **Job queue**: taustaprosessit (BullMQ/RSMQ) rate limit -ystävällisiin, pitkäkestoisiin GitHub-hakuihin.
- **GitHub-integraatio**: erillinen `integrations/github` jossa client, retry/backoff, circuit breaker, ETag/If-None-Match, pagination-utilityt.
- **Suorituskyky**: HTTP-keepalive, compression, ETag/Last-Modified, `helmet`, `cors`, `rate-limit`, `slow-down`.
- **Observability**: request/depency tracing (OpenTelemetry), metrics (Prometheus), terveys- ja readiness-probet.
- **Testaus**: yksikkö (services), integraatio (repos & integ.), sopimus (OpenAPI), e2e (supertest). Testidataa varten factories.
- **Koodistandardi**: ESLint, Prettier, Husky + lint-staged, commitlint, tsconfig-strict.
- **CI/CD**: GitHub Actions: lint/test/build, docker build & push, skannaus (Dependabot/Snyk), infra-as-code (Docker Compose/Helm).
- **Suojaus**: salaisuudet vain `secrets`/env, ei repoihin; `helmet`, input-sanitointi, riippuvuuksien päivitys, audit, SBOM (Syft).
- **Frontti**: pysy EJS:ssä mutta komponentoi ja jaa layout/partials; vaihtoehtoisesti siirto SSR/SPA:han kun logiikka on eriytetty.

### Refaktoroinnin konkreettiset ensimmäiset askeleet
1. **Pilkko `server.js`**:
   - Siirrä reitit `app/routes`, controllerit `app/controllers`, middlewaret `app/middlewares`.
   - Liiketoimintalogiikka `domain/services`, kaikki DB/GitHub-kutsut `data/repositories` ja `integrations/github`.
2. **Yhtenäinen virhe- ja logituskerros**:
   - `core/errors/AppError`, `core/logging/logger`, request-ID middleware.
3. **Konfiguraatio**:
   - `core/config/index.ts` + schema-validointi; poista ad-hoc `process.env` -käyttö muualta.
4. **GitHub API -kerros**:
   - Yksi client jossa retry/backoff, pagination helperit, ETag-käsittely, rate limit -respekti.
5. **Välimuisti ja työt**:
   - Redis cache GitHub-vastauksille, BullMQ-queue raskaille jobeille; UI hakee tilaa job-id:llä.
6. **TypeScript-migraatio** (progressiivinen):
   - Ota TS build pipeline, aloita ydinmoduuleista; lisää tyyppisopimukset DTO:ille.
7. **Testipohja**:
   - Lisää Jest/Vitest; aloita palvelukerroksen yksikkötesteistä ja GitHub-integraation sopimustesteistä.
8. **CI**:
   - Lint+test PR:issä, build ja Docker-image taggaus. Lisää `docker-compose.yml` deville.

### Nopeita voittoja nykytilaan
- Lisää `helmet`, `cors`, `express-rate-limit`, `compression`.
- Lisää request-logging ja virhemiddleware välittömästi.
- Ota käyttöön `.env` schema-validointi ja pakolliset avaimet käynnistyksessä.
- Cachea GitHub-vastaukset TTL:llä tiedostopohjaisesti, kunnes Redis lisätään.

### Migraatiostrategia (riskin minimointi)
- Tee kerros kerrallaan adaptereilla (old controller → new service). Pidä vanha ja uusi polku rinnakkain lyhyesti.
- Peitä uudet reitit ominaisuuskytkimellä; reletoi liikennettä vähitellen.
- Lisää observability ennen suuria muutoksia; mittaa virhe- ja latenssivaikutukset.

### Odotettavat vaikutukset
- Vähemmän regressioita, parempi testattavuus, selkeä omistajuus ja skaalautuvuus.
- Hallittu GitHub-rate limit -kuorma ja nopeammat vastaukset välimuistin ansiosta.
- Parempi turvallisuus ja näkyvyys tuotannossa.

Lyhyt yhteenveto:
- Pilko `server.js` kerrosarkkitehtuuriin, lisää virhe/logitus/config-ydin.
- Abstrahoi GitHub-integraatio retry+cache+pagination -toteutuksella.
- Lisää testaus, CI/CD ja perussuojaukset; etene vaiheittain ja mittaa vaikutukset.