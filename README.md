# 🏛️ Helsingin kaupunki - Sovellusportfolio

Node.js-sovellus joka hakee Helsingin kaupungin GitHub-organisaation repot ja analysoi niiden teknisiä ominaisuuksia, framework-versioita ja turvallisuustilannetta.

## ✨ Ominaisuudet

### 📊 Päänäkymä (Etusivu)
- 🔍 Hakee GitHub API:sta Helsingin kaupungin organisaation repot
- 📊 Näyttää repot selkeässä taulukko-muodossa
- 🥧 Piirakkagraafi kielijakaumasta
- 📈 Kieltien tilastot ja ranking
- 🌈 Kieltien värikoodaus
- 📱 Responsiivinen design kaikille laitteille
- 💾 SQLite3-tietokanta cache-tietojen tallennukseen

### 📝 Commits-sivu (`/commits`)
- 🔍 Näyttää viimeisimmät commitit kaikista repositoireista
- 📊 Reposiittokohtaiset commit-tilastot
- 👥 Top committerit
- 📈 Aktiivisuusgraafit
- 💬 Commit-viestien analyysi

### 👥 Teams-sivu (`/teams`)
- 🔍 Organisaation tiimit ja niiden jäsenet
- 📊 Tiimien repository-kytkennät
- 👤 Tiimien jäsenten luettelo
- 📈 Tiimien aktiivisuustilastot

### 🤝 Collaborators-sivu (`/collaborators`)
- 🔍 Repository-kohtaiset collaboratorit
- 👥 External collaboratorit
- 🔐 Collaboratorien oikeudet ja roolit
- 📊 Collaboratorien aktiivisuustilastot

### 🐛 Issues-sivu (`/issues`)
- 🔍 Näyttää kaikki avoimet ja suljetut issuet
- 📊 Issue-tilastot (avoimet, suljetut, määrä repoittain)
- 🏷️ Issue-tyyppien jakautuma
- 📈 Issue-prioriteetti ja trendit

### 🔀 Pull Requests-sivu (`/pull_requests`)
- 🔍 Näyttää kaikki avoimet ja suljetut pull requestit
- 📊 PR-tilastot (avoimet, suljetut, merged)
- 👁️ PR-review-tiedot
- ✅ Merge-statistiikat

### 🐳 Dockerfile-sivu
- 🔍 Analysoi Dockerfile-tiedostoja kaikista repostoista
- 📊 Näyttää käytetyt base image -tyypit
- 📈 Tilastot Docker-repositoryistä
- 🔗 Suorat linkit GitHubiin

### 🐍 Django-sivu
- 🔍 Analysoi Python-repositoryjä Django-versioiden osalta
- 📊 Näyttää Django-versioiden jakauman
- 📈 Tilastot Django-sovelluksista
- 🔍 Etsii requirements.txt ja pyproject.toml tiedostoista

### ⚛️ React-sivu
- 🔍 Analysoi JavaScript/TypeScript-repositoryjä React-versioiden osalta
- 📊 Näyttää React-versioiden jakauman
- 📈 Tilastot React-sovelluksista
- 🔍 Etsii package.json tiedostoista

### 🌐 Drupal-sivu
- 🔍 Analysoi PHP-repositoryjä Drupal-versioiden osalta
- 📊 Näyttää Drupal-versioiden jakauman
- 📈 Tilastot Drupal-sivustoista
- 🔍 Etsii composer.json tiedostoista

### 🛡️ Dependabot-sivu
- 🔍 Analysoi turvallisuusilmoituksia kaikista repostoista
- 📊 Näyttää kriittisten haavoittuvuuksien määrän
- 📈 Tilastot turvallisuustilanteesta
- ⚠️ Korostaa repot, joissa on kriittisiä haavoittuvuuksia

### 🎨 HDS-sivu
- 🔍 Analysoi Helsinki Design System -käyttöä frontend-repoissa
- 📊 Näyttää HDS-pakettien jakauman
- 📈 Tilastot HDS-versioista ja paketeista
- 🔍 Etsii package.json tiedostoista HDS-riippuvuuksia

## 🛠️ Teknologiat

- **Backend**: Node.js, Express.js
- **Frontend**: EJS templating, Tailwind CSS, JavaScript
- **API**: GitHub REST API, Dependabot API
- **Styling**: Tailwind CSS, Material Symbols, Font Awesome
- **Database**: SQLite3 (caching & data persistence)
- **Cache**: 
  - Redis-tuki (vapaaehtoinen, fallback SQLiteen)
  - Database-based caching with TTL support
  - Unified cache manager (Redis + SQLite/Memory fallback)
- **Migrations**: Database migration system
- **Testing**: Jest unit tests & integration tests
- **Charts**: SVG-based pie charts
- **Responsive**: Mobile-first design

## 📦 Asennus

### 1. Kloonaa repositorio
```bash
git clone <repository-url>
cd github-application-portfolio
```

### 2. Asenna riippuvuudet
```bash
npm install
```

### 3. Konfiguroi ympäristömuuttujat
```bash
cp env.example .env
```

### 4. Täytä .env tiedosto
```env
GITHUB_TOKEN=your_github_personal_access_token_here
GITHUB_ORG=City-of-Helsinki
PORT=3000
NODE_ENV=development

# Database
USE_DATABASE=true
DB_PATH=./portfolio.db
DB_ENABLE_WAL=true

# Cache (optional)
USE_REDIS=false
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CACHE_DEFAULT_TTL=3600000

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_DEBUG=false
```

### 5. Käynnistä sovellus

**Kehitystilassa:**
```bash
npm run dev
```

**Tuotantotilassa:**
```bash
npm start
```

## 🔑 GitHub API Setup

1. Mene GitHub:in asetuksiin: **Settings** > **Developer settings** > **Personal access tokens** > **Tokens (classic)**
2. Klikkaa **Generate new token (classic)**
3. Anna tokenille nimi (esim. "Portfolio App")
4. Valitse seuraavat oikeudet:
   - `repo` (Full control of private repositories)
   - `public_repo` (Access public repositories)
   - `read:org` (Read org and team membership)
   - `read:user` (Read user profile data)
5. Klikkaa **Generate token**
6. Kopioi token ja liitä se `.env` tiedostoon

## 🌐 Käyttö

1. Käynnistä sovellus
2. Avaa selain osoitteessa `http://localhost:3000`
3. Sovellus hakee automaattisesti GitHubista kaikki repositorion repot
4. Navigoi eri sivuille:
   - **Etusivu**: Yleiskatsaus repojen kielijakaumasta
   - **Repositories**: Suodatettava ja järjestettävä repository-lista
   - **Commits**: Viimeisimmät commitit ja tilastot
   - **Teams**: Organisaation tiimit ja jäsenet
   - **Collaborators**: Repository-kohtaiset collaboratorit
   - **Issues**: Issue-tilastot ja lista
   - **Pull Requests**: PR-tilastot ja lista
   - **Dockerfile**: Docker-kontainerien analyysi
   - **Django**: Python/Django-sovellukset
   - **React**: JavaScript/React-sovellukset
   - **Drupal**: PHP/Drupal-sivustot
   - **Dependabot**: Turvallisuusilmoitukset
   - **HDS**: Helsinki Design System -käyttö

## 📁 Projektin rakenne

```
github-application-portfolio/
├── src/
│   ├── app/
│   │   ├── controllers/      # HTTP-kontrollerit
│   │   ├── routes/           # Express-reitit
│   │   └── dependencies.js   # Dependency injection
│   ├── core/
│   │   ├── config.js         # Keskitetty konfiguraatio
│   │   ├── errors.js         # Virheenkäsittely
│   │   ├── logging.js        # Logging
│   │   └── utils/            # Yleiset apufunktiot
│   ├── data/
│   │   ├── database/         # Tietokantayhteys
│   │   ├── migrations/       # Tietokantamigraatiot
│   │   └── repositories/     # Tietokanta-operaatiot
│   ├── domain/
│   │   └── services/         # Liiketoimintalogiikka
│   └── integrations/
│       ├── cache/            # Cache-järjestelmät
│       └── github/           # GitHub API -integraatio
├── views/
│   ├── layouts/
│   │   └── base.ejs          # Yhteinen layout
│   ├── components/           # Uudelleenkäytettävät komponentit
│   ├── index.ejs             # Päänäkymä
│   ├── repositories.ejs      # Repositoryt-sivu
│   ├── commits.ejs           # Commits-sivu
│   ├── teams.ejs             # Teams-sivu
│   ├── collaborators.ejs     # Collaborators-sivu
│   ├── issues.ejs            # Issues-sivu
│   ├── pull_requests.ejs     # Pull Requests-sivu
│   └── ...                   # Muut sivut
├── tests/
│   ├── unit/                 # Yksikkötestit
│   ├── integration/          # Integraatiotestit
│   ├── fixtures/            # Testidata
│   └── setup.js             # Testien asetukset
├── public/
│   └── css/
│       └── style.css         # Tyylitiedostot
├── server.js                 # Pääpalvelin
├── portfolio.db              # SQLite3 tietokanta (cache)
├── package.json              # Riippuvuudet
├── env.example               # Ympäristömuuttujien malli
├── start.sh                  # Käynnistysskripti
├── README.md                  # Tämä dokumentaatio
├── ARCHITECTURE.md            # Arkkitehtuurikuvaus
└── docs/
    └── API.md                 # API-dokumentaatio
```

## 🔧 Konfiguraatio

### Ympäristömuuttujat

| Muuttuja | Kuvaus | Pakollinen | Oletus |
|----------|--------|------------|--------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | ✅ | - |
| `GITHUB_ORG` | GitHub organisaation nimi | ❌ | City-of-Helsinki |
| `PORT` | Palvelimen portti | ❌ | 3000 |
| `USE_DATABASE` | Tietokanta käytössä | ❌ | true |
| `DB_PATH` | Tietokannan tiedostopolku | ❌ | ./portfolio.db |
| `DB_ENABLE_WAL` | WAL-tila käytössä | ❌ | true |
| `USE_REDIS` | Redis-cache käytössä | ❌ | false |
| `REDIS_HOST` | Redis-palvelimen osoite | ❌ | localhost |
| `REDIS_PORT` | Redis-palvelimen portti | ❌ | 6379 |
| `REDIS_PASSWORD` | Redis-salasana | ❌ | - |
| `CACHE_DEFAULT_TTL` | Cache-oletus-TTL (ms) | ❌ | 3600000 |
| `RATE_LIMIT_ENABLED` | Rate limiting päällä/pois | ❌ | true |
| `RATE_LIMIT_DEBUG` | Rate limiting debug-tila | ❌ | false |
| `MAX_REPOSITORIES` | Rajoita repositoryjen määrä | ❌ | - |
| `NODE_ENV` | Ympäristö (development/production) | ❌ | development |

### API-rajapinnat

#### Sivut
- `GET /` - Päänäkymä (Etusivu)
- `GET /repositories` - Repositoryt-sivu (suodatuksella ja paginoinnilla)
- `GET /commits` - Commits-sivu
- `GET /teams` - Teams-sivu
- `GET /collaborators` - Collaborators-sivu
- `GET /issues` - Issues-sivu
- `GET /pull_requests` - Pull Requests-sivu
- `GET /dockerfile` - Dockerfile-sivu
- `GET /django` - Django-sivu
- `GET /react` - React-sivu
- `GET /drupal` - Drupal-sivu
- `GET /dependabot` - Dependabot-sivu
- `GET /hds` - HDS-sivu
- `GET /settings` - Asetukset-sivu

#### API-Endpointit
- `GET /api/repos` - JSON API repositorytietojen hakuun
- `GET /api/rate-limit` - Rate limit -tilan tarkistus
- `GET /api/cache` - Cache-tilastot
- `POST /api/cache/clear` - Cache-tyhjennys
- `POST /api/cache/invalidate/:repoName` - Invalidoi tietyn repon cache
- `POST /api/cache/cleanup` - Puhdista vanhentuneet cache-merkinnät
- `GET /api/db/repos` - Database-repojen haku
- `GET /api/db/stats` - Database-tilastot

Katso `docs/API.md` yksityiskohtaisemmasta API-dokumentaatiosta.

## 🧪 Testaus

### Yksikkötestit
```bash
npm test
```

### Testaus watch-tilassa
```bash
npm run test:watch
```

### Testikattavuus
```bash
npm run test:coverage
```

Katso `tests/README.md` lisätietoja testauksesta.

## 🎨 Mukauttaminen

### Väritys
Kielten värit määritellään `src/core/utils/languageColors.js` tiedostossa.

### Tyylit
- **Tailwind CSS**: Pääasiallinen CSS-framework
- **Custom CSS**: `public/css/style.css` - lisätyylit
- **Material Symbols**: Ikonit
- **Font Awesome**: Lisäikonit

### Layout
- **Base Layout**: `views/layouts/base.ejs` - yhteinen layout
- **Components**: `views/components/` - uudelleenkäytettävät komponentit
  - `header.ejs` - Yhteinen otsikko
  - `stats-card.ejs` - Tilastokortti
  - `data-table.ejs` - Datataulukko
  - `sidebar.ejs` - Sivupalkki

## 🐛 Ongelmatilanteet

### "GitHub API konfiguraatio puuttuu"
- Tarkista että `.env` tiedosto on olemassa
- Varmista että `GITHUB_TOKEN` ja `GITHUB_ORG` on määritelty

### "Virhe repojen latauksessa"
- Tarkista GitHub-token on voimassa
- Varmista että tokenilla on tarvittavat oikeudet
- Tarkista internet-yhteys

### Repot eivät lataudu
- Tarkista GitHub-organisaation nimi on oikein
- Varmista että organisaatiolla on julkisia repostoja
- Tarkista että repot eivät ole arkistoituja

### Cache-ongelmat
- Tyhjennä cache: `POST /api/cache/clear`
- Invalidoi tietyn repon cache: `POST /api/cache/invalidate/:repoName`
- Tarkista Redis-yhteys jos käytössä

### Tietokanta-ongelmat
- Tarkista että `USE_DATABASE=true` (jos käytössä)
- Tarkista tietokantatiedosto on oikeassa sijainnissa
- Suorita migraatiot uudelleen: poista `portfolio.db` ja käynnistä sovellus

### Docker/Django/React/Drupal/HDS-tiedot eivät näy
- Tarkista että repositoryt sisältävät vastaavat tiedostot
- Tarkista GitHub API rate limits
- Tyhjennä cache

### Dependabot-tiedot eivät lataudu
- Varmista että Dependabot on otettu käyttöön repositoryissa
- Tarkista että tokenilla on `security_events` oikeus
- Tarkista että repositoryt eivät ole arkistoituja

## 📝 Kehitys

### Lisää ominaisuus
1. Forkkaa repositorio
2. Luo feature-haara (`git checkout -b feature/amazing-feature`)
3. Commit muutokset (`git commit -m 'Add amazing feature'`)
4. Push haaraan (`git push origin feature/amazing-feature`)
5. Luo Pull Request

### Kehitystyökalut
```bash
# Kehitystilassa
npm run dev

# Testaus
npm test
npm run test:watch

# Linting (jos konfiguroitu)
npm run lint
```

## 🏗️ Arkkitehtuuri

Sovellus käyttää **kerrosarkkitehtuuria**:
- **Routes** (`src/app/routes/`) - HTTP-reitit
- **Controllers** (`src/app/controllers/`) - HTTP-pyyntöjen käsittely
- **Services** (`src/domain/services/`) - Liiketoimintalogiikka
- **Repositories** (`src/data/repositories/`) - Tietokanta-operaatiot
- **Integrations** (`src/integrations/`) - Ulkoiset API:t

Katso `ARCHITECTURE.md` yksityiskohtaisemmasta arkkitehtuurikuvauksesta.

## 📄 Lisenssi

MIT License - katso [LICENSE](LICENSE) tiedosto lisätietoja varten.

## 🤝 Avustaminen

Avustaminen on tervetullutta! Jos löydät bugin tai sinulla on idea uudelle ominaisuudelle, ota yhteyttä tai tee Pull Request.

## 📞 Yhteystiedot

- GitHub: [@juhasuv](https://github.com/juhasuv)


---

⭐ Jos pidit projektista, anna tähti GitHubissa!
