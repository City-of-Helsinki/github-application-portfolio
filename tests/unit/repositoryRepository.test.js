/**
 * Unit tests for RepositoryRepository
 */

const RepositoryRepository = require('../../src/data/repositories/repositoryRepository');

describe('RepositoryRepository', () => {
  let repository;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      serialize: jest.fn((callback) => callback()),
      run: jest.fn((query, callback) => {
        if (callback) callback(null);
      }),
      all: jest.fn((query, params, callback) => {
        if (callback) callback(null, []);
      }),
      get: jest.fn((query, params, callback) => {
        if (callback) callback(null, { count: 0 });
      })
    };

    repository = new RepositoryRepository(mockDb);
    repository.useDatabase = true;
  });

  describe('getAllRepositories', () => {
    it('should return empty array when database is disabled', async () => {
      repository.useDatabase = false;
      repository.db = null;

      const result = await repository.getAllRepositories();

      expect(result).toEqual([]);
    });

    it('should return repositories from database', async () => {
      const mockRepos = [
        { name: 'repo1', languages: '{}', topics: '[]', all_teams: '[]', dependabot_permissions: '[]' },
        { name: 'repo2', languages: '{}', topics: '[]', all_teams: '[]', dependabot_permissions: '[]' }
      ];

      mockDb.all = jest.fn((query, params, callback) => {
        if (typeof params === 'function') {
          params(null, mockRepos);
        } else if (callback) {
          callback(null, mockRepos);
        }
      });

      const result = await repository.getAllRepositories();

      expect(mockDb.all).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('languages');
      expect(result[0]).toHaveProperty('topics');
    });

    it('should apply filters when provided', async () => {
      mockDb.all = jest.fn((query, params, callback) => {
        expect(query).toContain('WHERE');
        expect(params).toContain('JavaScript');
        if (callback) callback(null, []);
      });

      await repository.getAllRepositories({
        language: 'JavaScript',
        minStars: 10
      });

      expect(mockDb.all).toHaveBeenCalled();
    });

    it('should apply pagination when provided', async () => {
      mockDb.all = jest.fn((query, params, callback) => {
        expect(query).toContain('LIMIT');
        expect(query).toContain('OFFSET');
        expect(params).toContain(10); // limit
        expect(params).toContain(20); // offset
        if (callback) callback(null, []);
      });

      await repository.getAllRepositories({
        limit: 10,
        offset: 20
      });

      expect(mockDb.all).toHaveBeenCalled();
    });
  });

  describe('getRepositoryCount', () => {
    it('should return count from database', async () => {
      mockDb.get = jest.fn((query, params, callback) => {
        if (typeof params === 'function') {
          params(null, { count: 5 });
        } else if (callback) {
          callback(null, { count: 5 });
        }
      });

      const result = await repository.getRepositoryCount();

      expect(mockDb.get).toHaveBeenCalled();
      expect(result).toBe(5);
    });

    it('should apply filters when counting', async () => {
      mockDb.get = jest.fn((query, params, callback) => {
        expect(query).toContain('WHERE');
        expect(params).toContain('JavaScript');
        if (callback) callback(null, { count: 3 });
      });

      const result = await repository.getRepositoryCount({
        language: 'JavaScript'
      });

      expect(result).toBe(3);
    });
  });

  describe('saveRepository', () => {
    it('should save repository to database', async () => {
      const repo = {
        name: 'test-repo',
        full_name: 'org/test-repo',
        description: 'Test',
        languages: { JavaScript: 100 },
        topics: ['test'],
        all_teams: ['team1'],
        dependabot_permissions: ['read']
      };

      mockDb.run = jest.fn((query, params, callback) => {
        if (typeof params === 'function') {
          params(null);
        } else if (callback) {
          callback(null);
        }
      });

      await repository.saveRepository(repo);

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should not save when database is disabled', async () => {
      repository.useDatabase = false;

      await repository.saveRepository({ name: 'test' });

      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });
});

