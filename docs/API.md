# 📡 API-dokumentaatio

Tämä dokumentti kuvaa sovelluksen REST API -rajapinnat.

## Yleistä

### Base URL
```
http://localhost:3000
```

### Autentikointi
Tällä hetkellä API ei vaadi autentikointia. Kaikki endpointit ovat julkisia.

### Vastausmuoto
Kaikki API-vastaukset ovat JSON-muodossa.

### Virheenkäsittely
API palauttaa standardi HTTP-statuskoodeja:
- `200 OK` - Onnistunut pyyntö
- `400 Bad Request` - Väärä pyyntö
- `404 Not Found` - Resurssia ei löydy
- `500 Internal Server Error` - Palvelinvirhe

## View Routes (Sivut)

### GET /
Päänäkymä - Kielijakauma ja repository-yhteenveto.

**Query Parameters:**
- `refresh=true` - Pakottaa datan päivityksen cachesta

**Vastaus:** HTML-sivu

---

### GET /repositories
Repositoryt-sivu - Suodatettava ja järjestettävä repository-lista.

**Query Parameters:**
- `language` - Suodata kielen perusteella (esim. `?language=JavaScript`)
- `minStars` - Vähimmäistähtimäärä (esim. `?minStars=10`)
- `orderBy` - Järjestys (esim. `?orderBy=updated_at` tai `?orderBy=stargazers_count`)
- `orderDirection` - Järjestyksen suunta (`ASC` tai `DESC`, oletus: `DESC`)
- `limit` - Sivun koko (esim. `?limit=20`)
- `offset` - Sivun offset (esim. `?offset=0`)
- `refresh=true` - Pakottaa datan päivityksen cachesta

**Vastaus:** HTML-sivu

---

### GET /commits
Commits-sivu - Viimeisimmät commitit ja tilastot.

**Query Parameters:**
- `refresh=true` - Pakottaa datan päivityksen cachesta

**Vastaus:** HTML-sivu

---

### GET /teams
Teams-sivu - Organisaation tiimit ja jäsenet.

**Query Parameters:**
- `refresh=true` - Pakottaa datan päivityksen cachesta

**Vastaus:** HTML-sivu

---

### GET /collaborators
Collaborators-sivu - Repository-kohtaiset collaboratorit.

**Query Parameters:**
- `refresh=true` - Pakottaa datan päivityksen cachesta

**Vastaus:** HTML-sivu

---

### GET /issues
Issues-sivu - Issue-tilastot ja lista.

**Query Parameters:**
- `state` - Issue-tila (`open`, `closed`, `all`, oletus: `all`)
- `refresh=true` - Pakottaa datan päivityksen cachesta

**Vastaus:** HTML-sivu

---

### GET /pull_requests
Pull Requests-sivu - PR-tilastot ja lista.

**Query Parameters:**
- `state` - PR-tila (`open`, `closed`, `all`, oletus: `all`)
- `refresh=true` - Pakottaa datan päivityksen cachesta

**Vastaus:** HTML-sivu

---

## API Endpoints

### GET /api/repos
Hae kaikki repositoryt JSON-muodossa.

**Query Parameters:**
- `language` - Suodata kielen perusteella
- `minStars` - Vähimmäistähtimäärä
- `orderBy` - Järjestys
- `orderDirection` - Järjestyksen suunta (`ASC` tai `DESC`)
- `limit` - Sivun koko
- `offset` - Sivun offset
- `refresh=true` - Pakottaa datan päivityksen cachesta

**Vastaus:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "repo-name",
      "full_name": "org/repo-name",
      "description": "Repository description",
      "html_url": "https://github.com/org/repo-name",
      "language": "JavaScript",
      "stargazers_count": 10,
      "forks_count": 5,
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

---

### GET /api/rate-limit
Hae GitHub API:n rate limit -tila.

**Vastaus:**
```json
{
  "limit": 5000,
  "remaining": 4999,
  "used": 1,
  "reset": 1704067200,
  "percentageUsed": 0.02,
  "isAtLimit": false
}
```

---

### GET /api/cache
Hae cache-tilastot ja tiedot.

**Vastaus:**
```json
{
  "hits": 100,
  "misses": 50,
  "totalRequests": 150,
  "hitRate": 66.67,
  "size": 25,
  "info": {
    "type": "unified",
    "redis": {
      "enabled": false,
      "connected": false
    },
    "database": {
      "enabled": true,
      "size": 25
    }
  },
  "repository": {
    "size": 25,
    "type": "database"
  },
  "memoryUsageMB": 45,
  "uptime": 3600
}
```

---

### POST /api/cache/clear
Tyhjennä koko cache.

**Vastaus:**
```json
{
  "message": "Cache cleared successfully"
}
```

---

### POST /api/cache/invalidate/:repoName
Invalidoi tietyn repon cache.

**URL Parameters:**
- `repoName` - Repositoryn nimi (esim. `my-repo`)

**Vastaus:**
```json
{
  "message": "Cache invalidated for repository: my-repo"
}
```

---

### POST /api/cache/cleanup
Puhdista vanhentuneet cache-merkinnät.

**Vastaus:**
```json
{
  "message": "Expired cache entries cleaned successfully"
}
```

---

### GET /api/db/repos
Hae repositoryt tietokannasta.

**Vastaus:**
```json
[
  {
    "id": 1,
    "name": "repo-name",
    "full_name": "org/repo-name",
    "description": "Repository description",
    "language": "JavaScript",
    "stargazers_count": 10,
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### GET /api/db/stats
Hae tietokantatilastot.

**Vastaus:**
```json
{
  "repositories": 50,
  "cacheEntries": 25,
  "databaseSize": "2.5 MB"
}
```

---

## Esimerkkejä

### cURL-esimerkkejä

#### Hae kaikki repositoryt
```bash
curl http://localhost:3000/api/repos
```

#### Hae JavaScript-repositoryt
```bash
curl "http://localhost:3000/api/repos?language=JavaScript"
```

#### Hae repositoryt suodatuksella ja paginoinnilla
```bash
curl "http://localhost:3000/api/repos?language=TypeScript&minStars=10&orderBy=stargazers_count&orderDirection=DESC&limit=20&offset=0"
```

#### Hae cache-tilastot
```bash
curl http://localhost:3000/api/cache
```

#### Tyhjennä cache
```bash
curl -X POST http://localhost:3000/api/cache/clear
```

#### Invalidoi tietyn repon cache
```bash
curl -X POST http://localhost:3000/api/cache/invalidate/my-repo
```

#### Hae rate limit -tila
```bash
curl http://localhost:3000/api/rate-limit
```

---

## GitHub API Integraatio

Sovellus käyttää GitHub REST API:a seuraavien endpointtien kautta:

### Repository API
- `GET /orgs/{org}/repos` - Hae organisaation repositoryt
- `GET /repos/{owner}/{repo}` - Hae yksittäisen repositoryn tiedot
- `GET /repos/{owner}/{repo}/contents/{path}` - Hae tiedoston sisältö

### Commits API
- `GET /repos/{owner}/{repo}/commits` - Hae repositoryn commitit

### Teams API
- `GET /orgs/{org}/teams` - Hae organisaation tiimit
- `GET /orgs/{org}/teams/{team_slug}/members` - Hae tiimin jäsenet

### Collaborators API
- `GET /repos/{owner}/{repo}/collaborators` - Hae repositoryn collaboratorit

### Issues API
- `GET /repos/{owner}/{repo}/issues` - Hae repositoryn issuet

### Pull Requests API
- `GET /repos/{owner}/{repo}/pulls` - Hae repositoryn pull requestit

### Dependabot API
- `GET /repos/{owner}/{repo}/dependabot/alerts` - Hae turvallisuusilmoitukset

Lisätietoja: [GitHub API Documentation](https://docs.github.com/en/rest)

---

## Rate Limiting

Sovellus noudattaa GitHub API:n rate limitejä:
- **5000 requests/hour** per GitHub token
- Automaattinen throttling ja queue-management
- Graceful degradation kun rate limit on saavutettu

Tarkista rate limit -tila: `GET /api/rate-limit`

---

## Cache-strategia

### Cache-avaimet
- `org_repos_${org}` - Organisaation repolista (TTL: 1h)
- `${repoName}:django_version` - Django-versio (TTL: 12h)
- `${repoName}:react_version` - React-versio (TTL: 12h)
- `${repoName}:docker_base_images` - Docker-data (TTL: 24h)
- `latest_commit_data_${owner}_${repo}` - Commit-data (TTL: 1h)
- `org_teams_${org}` - Tiimi-data (TTL: 6h)
- `collaborators_${owner}_${repo}` - Collaborator-data (TTL: 6h)

### Cache-invalidointi
- **TTL-pohjainen**: Automaattinen vanhentuminen
- **Manuaalinen**: `?refresh=true` pakottaa päivityksen
- **Repo-kohtainen**: `POST /api/cache/invalidate/:repoName`
- **Koko cache**: `POST /api/cache/clear`

---

## Virheenkäsittely

### Virheiden muoto
```json
{
  "error": "Error type",
  "message": "Error message",
  "details": "Additional error details (optional)"
}
```

### Yleisiä virheitä

#### 400 Bad Request
```json
{
  "error": "Invalid query parameter",
  "message": "Invalid value for 'orderBy' parameter"
}
```

#### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Repository 'my-repo' not found"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

---

## Versiointi

Tällä hetkellä API ei käytä versiointia. Tulevaisuudessa API saattaa käyttää URL-pohjaista versiointia:
- `/api/v1/...`

---

## Tukea

Jos kohtaat ongelmia API:n kanssa:
1. Tarkista että palvelin on käynnissä
2. Tarkista että GitHub-token on määritelty
3. Tarkista rate limit -tila: `GET /api/rate-limit`
4. Tarkista virhelokit palvelimen konsolista

Lisätietoja: [README.md](../README.md) ja [ARCHITECTURE.md](../ARCHITECTURE.md)

