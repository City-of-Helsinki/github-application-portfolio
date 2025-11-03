/**
 * Unit tests for CommitsService
 */

const CommitsService = require('../../src/domain/services/commitsService');

// Mock dependencies
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

describe('CommitsService', () => {
  let service;
  let mockCacheManager;
  let mockRepositoryService;

  beforeEach(() => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn()
    };

    service = new CommitsService(mockCacheManager);
  });

  describe('getLatestCommitData', () => {
    it('should return cached commit data when available', async () => {
      const cachedData = { author: 'test-user', message: 'Test commit', date: '2024-01-01' };
      mockCacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getLatestCommitData('owner', 'repo');

      expect(mockCacheManager.get).toHaveBeenCalledWith('latest_commit_data_owner_repo');
      expect(result).toEqual(cachedData);
    });

    it('should fetch from API when cache is empty', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      // Mock GitHub client
      const { githubClient } = require('../../src/integrations/github/client');
      githubClient.request.mockResolvedValue({
        data: [{
          sha: 'abc123',
          html_url: 'https://github.com/owner/repo/commit/abc123',
          commit: {
            message: 'Test commit',
            author: { date: '2024-01-01T00:00:00Z', name: 'Test User' }
          },
          author: { login: 'test-user', html_url: 'https://github.com/test-user', avatar_url: 'https://github.com/avatar.png' }
        }]
      });

      const result = await service.getLatestCommitData('owner', 'repo');

      expect(githubClient.request).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
      expect(result).toHaveProperty('author');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('date');
    });

    it('should handle errors gracefully', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const { githubClient } = require('../../src/integrations/github/client');
      githubClient.request.mockRejectedValue(new Error('API Error'));

      const result = await service.getLatestCommitData('owner', 'repo');

      expect(result).toEqual({ author: null, message: null, date: null, sha: null, url: null });
    });
  });

  describe('getCommitStatistics', () => {
    it('should return commit statistics for repositories', async () => {
      const mockRepos = [
        { name: 'repo1', owner: { login: 'owner' }, archived: false, html_url: 'https://github.com/owner/repo1' },
        { name: 'repo2', owner: { login: 'owner' }, archived: false, html_url: 'https://github.com/owner/repo2' }
      ];

      const { githubClient } = require('../../src/integrations/github/client');
      githubClient.request.mockResolvedValue({
        data: [{
          sha: 'abc123',
          html_url: 'https://github.com/owner/repo1/commit/abc123',
          commit: {
            message: 'Test commit',
            author: { date: '2024-01-01T00:00:00Z', name: 'Test User' }
          },
          author: { login: 'user1', html_url: 'https://github.com/user1', avatar_url: 'https://github.com/avatar.png' }
        }]
      });
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getCommitStatistics(mockRepos);

      expect(result).toHaveProperty('repositories');
      expect(result).toHaveProperty('stats');
      expect(result.stats).toHaveProperty('totalCommits');
      expect(result.stats).toHaveProperty('reposWithCommits');
      expect(result.stats).toHaveProperty('reposWithoutCommits');
      expect(result.stats).toHaveProperty('topCommitters');
      expect(result.stats).toHaveProperty('recentCommits');
    });
  });
});

