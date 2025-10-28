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

### 🐳 Dockerfile-sivu
- 🔍 Analysoi Dockerfile-tiedostoja kaikista repostoista
- 📊 Näyttää käytetyt base image -tyypit
- 📈 Tilastot Docker-repositoryistä
- 🔗 Suorat linkit GitHubiin
- ⚠️ EOL-tietojen tarkistus Docker base imageille

### 🐍 Django-sivu
- 🔍 Analysoi Python-repositoryjä Django-versioiden osalta
- 📊 Näyttää Django-versioiden jakauman
- 📈 Tilastot Django-sovelluksista
- 🔍 Etsii requirements.txt ja pyproject.toml tiedostoista
- ⚠️ EOL-tietojen tarkistus Django-versioille

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
- **Cache**: Database-based caching with TTL support
- **Charts**: SVG-based pie charts
- **Responsive**: Mobile-first design
- **EOL Data**: Django & Docker EOL-tietojen tarkistus

## 📦 Asennus

### 1. Kloonaa repositorio
```bash
git clone <repository-url>
cd application-portfolio
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

**Tai käytä käynnistysskriptiä:**
```bash
./start.sh
```

## 🔑 GitHub API Setup

1. Mene GitHub:in asetuksiin: **Settings** > **Developer settings** > **Personal access tokens** > **Tokens (classic)**
2. Klikkaa **Generate new token (classic)**
3. Anna tokenille nimi (esim. "Portfolio App")
4. Valitse seuraavat oikeudet:
   - `repo` (Full control of private repositories)
   - `public_repo` (Access public repositories)
5. Klikkaa **Generate token**
6. Kopioi token ja liitä se `.env` tiedostoon

## 🌐 Käyttö

1. Käynnistä sovellus
2. Avaa selain osoitteessa `http://localhost:3000`
3. Sovellus hakee automaattisesti GitHubista kaikki repositorion repot
4. Navigoi eri sivuille:
   - **Etusivu**: Yleiskatsaus repojen kielijakaumasta
   - **Dockerfile**: Docker-kontainerien analyysi
   - **Django**: Python/Django-sovellukset
   - **React**: JavaScript/React-sovellukset
  - **Drupal**: PHP/Drupal-sivustot
  - **Dependabot**: Turvallisuusilmoitukset
  - **HDS**: Helsinki Design System -käyttö

## 📁 Projektin rakenne

```
application-portfolio/
├── public/
│   └── css/
│       └── style.css          # Tyylitiedostot
├── views/
│   ├── index.ejs             # Päänäkymä (Etusivu)
│   ├── dockerfile.ejs        # Dockerfile-sivu
│   ├── django.ejs            # Django-sivu
│   ├── react.ejs             # React-sivu
│   ├── drupal.ejs            # Drupal-sivu
│   ├── dependabot.ejs        # Dependabot-sivu
│   ├── hds.ejs               # HDS-sivu
│   ├── settings.ejs          # Asetukset-sivu
│   └── error.ejs             # Virhenäkymä
├── server.js                 # Pääpalvelin (API-routes, data-fetching)
├── portfolio.db              # SQLite3 tietokanta (cache)
├── django-eol.json           # Django EOL-tiedot
├── docker-eol.json           # Docker EOL-tiedot
├── package.json              # Riippuvuudet
├── env.example               # Ympäristömuuttujien malli
├── start.sh                  # Käynnistysskripti
└── README.md                 # Dokumentaatio
```

## 🔧 Konfiguraatio

### Ympäristömuuttujat

| Muuttuja | Kuvaus | Pakollinen |
|----------|--------|------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | ✅ |
| `GITHUB_ORG` | GitHub organisaation nimi (oletus: City-of-Helsinki) | ❌ |
| `PORT` | Palvelimen portti (oletus: 3000) | ❌ |
| `RATE_LIMIT_ENABLED` | Rate limiting päällä/pois (oletus: true) | ❌ |
| `RATE_LIMIT_DEBUG` | Rate limiting debug-tila (oletus: false) | ❌ |
| `NODE_ENV` | Ympäristö (development/production) | ❌ |

### API-rajapinnat

- `GET /` - Päänäkymä (Etusivu) - kielijakauma ja repositoryt
- `GET /dockerfile` - Dockerfile-sivu - Docker-analyysi
- `GET /django` - Django-sivu - Python/Django-sovellukset
- `GET /react` - React-sivu - JavaScript/React-sovellukset
- `GET /drupal` - Drupal-sivu - PHP/Drupal-sivustot
- `GET /dependabot` - Dependabot-sivu - Turvallisuusilmoitukset
- `GET /hds` - HDS-sivu - Helsinki Design System -käyttö
- `GET /settings` - Asetukset-sivu - Sovellusasetukset

## 🎨 Mukauttaminen

### Väritys
Kielten värit määritellään `server.js` tiedostossa `getLanguageColor` funktiossa.

### Tyylit
- **Tailwind CSS**: Pääasiallinen CSS-framework
- **Custom CSS**: `public/css/style.css` - lisätyylit
- **Material Symbols**: Ikonit
- **Font Awesome**: Lisäikonit

### Layout
EJS-templatit löytyvät `views/` kansiosta:
- `index.ejs` - Etusivu (kielijakauma)
- `dockerfile.ejs` - Docker-analyysi
- `django.ejs` - Django-sovellukset
- `react.ejs` - React-sovellukset
- `drupal.ejs` - Drupal-sivustot
- `dependabot.ejs` - Turvallisuusilmoitukset
- `hds.ejs` - Helsinki Design System
- `settings.ejs` - Sovellusasetukset

### Data-haku
Kaikki data-haku tapahtuu `server.js` tiedostossa:
- `getRecentRepositories()` - GitHub-repojen haku
- `getDockerDataForRepo()` - Dockerfile-analyysi
- `getDjangoDataForRepo()` - Django-versioiden haku
- `getReactDataForRepo()` - React-versioiden haku
- `getDrupalDataForRepo()` - Drupal-versioiden haku
- `getDependabotDataForRepo()` - Turvallisuusilmoitusten haku
- `getHDSDataForRepo()` - HDS-pakettien haku

### EOL-tietojen tarkistus
- `checkDjangoEOL()` - Tarkistaa Django-versioiden EOL-tilanteen
- `checkDockerEOL()` - Tarkistaa Docker base image -tietojen EOL-tilanteen

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

### Docker/Django/React/Drupal/HDS-tiedot eivät näy
- Tarkista että repositoryt sisältävät vastaavat tiedostot (Dockerfile, requirements.txt, package.json, composer.json)
- Tarkista GitHub API rate limits
- Tyhjennä cache poistamalla `portfolio.db` tiedosto

### Dependabot-tiedot eivät lataudu
- Varmista että Dependabot on otettu käyttöön repositoryissa
- Tarkista että tokenilla on `security_events` oikeus
- Tarkista että repositoryt eivät ole arkistoituja

### HDS-tiedot eivät lataudu
- Varmista että repositoryt ovat frontend-projekteja (JavaScript/TypeScript)
- Tarkista että `package.json` tiedosto on olemassa
- Tarkista että HDS-paketit ovat dependencies- tai devDependencies-osiossa

## 📝 Kehitys

### Lisää ominaisuus
1. Forkkaa repositorio
2. Luo feature-haara (`git checkout -b feature/amazing-feature`)
3. Commit muutokset (`git commit -m 'Add amazing feature'`)
4. Push haaraan (`git push origin feature/amazing-feature`)
5. Luo Pull Request

### Testaus
```bash
# Käynnistä kehitystilassa
npm run dev

# Testaa eri selaimilla
# Testaa responsiivisuus
# Testaa virhetilanteet
```

## 📄 Lisenssi

MIT License - katso [LICENSE](LICENSE) tiedosto lisätietoja varten.

## 🤝 Avustaminen

Avustaminen on tervetullutta! Jos löydät bugin tai sinulla on idea uudelle ominaisuudelle, ota yhteyttä tai tee Pull Request.

## 📞 Yhteystiedot

- GitHub: [@juhasuv](https://github.com/juhasuv)
- Portfolio: [http://localhost:3000](http://localhost:3000)

---

⭐ Jos pidit projektista, anna tähti GitHubissa!
