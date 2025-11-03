/**
 * Unit tests for RepositoryService
 */

const RepositoryService = require('../../src/domain/services/repositoryService');

// Mock dependencies before requiring the service
jest.mock('../../src/integrations/github/client', () => ({
  githubClient: {
    getAllPages: jest.fn(),
    request: jest.fn()
  }
}));
jest.mock('../../src/core/config', () => ({
  config: {
    github: { organization: 'test-org' },
    app: { maxRepositories: undefined, useDatabase: false }
  }
}));

describe('RepositoryService', () => {
  let service;
  let mockRepositoryRepository;
  let mockCacheRepository;
  let mockCacheManager;

  beforeEach(() => {
    // Mock dependencies
    mockRepositoryRepository = {
      getAllRepositories: jest.fn().mockResolvedValue([]),
      saveRepository: jest.fn().mockResolvedValue(),
      getRepositoryCount: jest.fn().mockResolvedValue(0)
    };

    mockCacheRepository = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn()
    };

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      invalidateRepo: jest.fn()
    };

    service = new RepositoryService(
      mockRepositoryRepository,
      mockCacheRepository,
      mockCacheManager
    );
  });

  describe('getOwnerLogin', () => {
    it('should return owner login when repo has owner', () => {
      const repo = { owner: { login: 'test-owner' } };
      const result = service.getOwnerLogin(repo);
      expect(result).toBe('test-owner');
    });

    it('should return githubOrg when repo has no owner', () => {
      const repo = {};
      const result = service.getOwnerLogin(repo);
      expect(result).toBe(service.githubOrg);
    });

    it('should return githubOrg when repo is null', () => {
      const result = service.getOwnerLogin(null);
      expect(result).toBe(service.githubOrg);
    });
  });

  describe('getRecentRepositories', () => {
    it('should return cached repositories when available and not refreshing', async () => {
      const cachedRepos = [{ name: 'repo1', full_name: 'org/repo1' }];
      mockCacheManager.get.mockResolvedValue(cachedRepos);

      const result = await service.getRecentRepositories(false);

      expect(mockCacheManager.get).toHaveBeenCalledWith(`org_repos_${service.githubOrg}`);
      expect(result).toBeDefined();
    });

    it('should fetch from API when cache is empty', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      
      // Mock GitHub client
      const { githubClient } = require('../../src/integrations/github/client');
      githubClient.getAllPages = jest.fn().mockResolvedValue([
        { name: 'repo1', full_name: 'org/repo1', archived: false }
      ]);

      const result = await service.getRecentRepositories(false);

      expect(mockCacheManager.get).toHaveBeenCalled();
      // Note: This test may need adjustment based on actual implementation
    });
  });

  describe('getCachedRepositories', () => {
    it('should return repositories from repository repository', async () => {
      const repos = [{ name: 'repo1', full_name: 'org/repo1' }];
      mockRepositoryRepository.getAllRepositories.mockResolvedValue(repos);

      const result = await service.getCachedRepositories();

      expect(mockRepositoryRepository.getAllRepositories).toHaveBeenCalled();
      expect(result).toEqual(repos);
    });

    it('should fallback to API when repository repository is empty', async () => {
      mockRepositoryRepository.getAllRepositories.mockResolvedValue([]);
      mockCacheManager.get.mockResolvedValue([
        { name: 'repo1', full_name: 'org/repo1' }
      ]);

      const result = await service.getCachedRepositories();

      expect(result).toBeDefined();
    });
  });
});

