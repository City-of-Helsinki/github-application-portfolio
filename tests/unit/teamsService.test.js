/**
 * Unit tests for TeamsService
 */

const TeamsService = require('../../src/domain/services/teamsService');

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

describe('TeamsService', () => {
  let service;
  let mockCacheManager;
  let mockRepositoryService;

  beforeEach(() => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn()
    };

    mockRepositoryService = {
      getRecentRepositories: jest.fn().mockResolvedValue([]),
      getCachedRepositories: jest.fn().mockResolvedValue([])
    };

    service = new TeamsService(mockCacheManager, mockRepositoryService);
  });

  describe('getAllTeams', () => {
    it('should return cached teams when available and not refreshing', async () => {
      const cachedTeams = [{ name: 'Team Alpha', slug: 'team-alpha' }];
      mockCacheManager.get.mockResolvedValue(cachedTeams);

      const result = await service.getAllTeams(false);

      expect(mockCacheManager.get).toHaveBeenCalledWith(`org_teams_test-org`);
      expect(result).toEqual(cachedTeams);
    });

    it('should fetch from API when cache is empty', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const { githubClient } = require('../../src/integrations/github/client');
      githubClient.getAllPages = jest.fn().mockResolvedValue([
        { name: 'Team Beta', slug: 'team-beta' }
      ]);

      const result = await service.getAllTeams(false);

      expect(githubClient.getAllPages).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('getTeamMembers', () => {
    it('should return team members', async () => {
      const mockMembers = [
        { login: 'user1' },
        { login: 'user2' }
      ];

      mockCacheManager.get.mockResolvedValue(null);

      const { githubClient } = require('../../src/integrations/github/client');
      githubClient.getAllPages = jest.fn().mockResolvedValue(mockMembers);

      const result = await service.getTeamMembers('test-team');

      expect(githubClient.getAllPages).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('getTeamsStatistics', () => {
    it('should calculate team statistics correctly', async () => {
      const teams = [
        { name: 'Team Alpha', slug: 'team-alpha' },
        { name: 'Team Beta', slug: 'team-beta' }
      ];

      const repositories = [
        { name: 'repo1', all_teams: ['Team Alpha'] },
        { name: 'repo2', all_teams: ['Team Alpha', 'Team Beta'] }
      ];

      mockCacheManager.get.mockResolvedValue([
        { login: 'user1' },
        { login: 'user2' }
      ]);

      const result = await service.getTeamsStatistics(teams, repositories);

      expect(result).toHaveProperty('teams');
      expect(result).toHaveProperty('stats');
      expect(result.stats).toHaveProperty('totalTeams');
      expect(result.stats).toHaveProperty('teamsWithRepos');
      expect(result.stats).toHaveProperty('totalMembers');
    });
  });
});

