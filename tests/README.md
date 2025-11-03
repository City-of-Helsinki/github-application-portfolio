# Testaus

Tämä kansio sisältää sovelluksen testit.

## Testirakenne

```
tests/
├── unit/              # Yksikkötestit
│   ├── repositoryService.test.js
│   ├── commitsService.test.js
│   ├── cacheManager.test.js
│   └── repositoryRepository.test.js
├── integration/       # Integraatiotestit
│   ├── repositories.routes.test.js
│   └── commits.routes.test.js
├── fixtures/          # Testidata
│   ├── repositories.js
│   ├── commits.js
│   └── teams.js
├── setup.js           # Testien asetukset
└── README.md          # Tämä tiedosto
```

## Testien suorittaminen

### Kaikki testit
```bash
npm test
```

### Watch mode (automaattinen uudelleenajo muutoksilla)
```bash
npm run test:watch
```

### Coverage-raportti
```bash
npm run test:coverage
```

## Testikattavuus

Testikattavuusraportti generoidaan `coverage/`-kansioon.

### Yksikkötestit

Testaavat yksittäisiä palveluita, repositoryjä ja muiden komponenttien toiminnallisuutta mockattujen riippuvuuksien kanssa.

### Integraatiotestit

Testaavat HTTP-reittejä ja niiden vastauksia end-to-end -tyylillä.

## Mockit

Testit käyttävät mockeja välttyäkseen ulkoisten riippuvuuksien käyttöön:
- GitHub API -mockit
- Tietokanta-mockit
- Cache-mockit

## Fixtures

Yleisesti käytettävää testidataa on `fixtures/`-kansiossa.

## Testien kirjoittaminen

1. Yksikkötestit: Testaa yhden komponentin toiminnallisuutta mockattujen riippuvuuksien kanssa
2. Integraatiotestit: Testaa useiden komponenttien yhteistoimintaa

### Esimerkki yksikkötestistä

```javascript
describe('MyService', () => {
  let service;
  let mockDependency;

  beforeEach(() => {
    mockDependency = {
      getData: jest.fn().mockResolvedValue({ data: 'test' })
    };
    service = new MyService(mockDependency);
  });

  it('should process data correctly', async () => {
    const result = await service.process();
    expect(result).toBeDefined();
    expect(mockDependency.getData).toHaveBeenCalled();
  });
});
```

