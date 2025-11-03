/**
 * Service layer for pull requests business logic
 * Handles all pull requests-related operations
 */

const { githubClient } = require('../../integrations/github/client');
const { config } = require('../../core/config');

class PullRequestsService {
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
    this.githubOrg = config.github.organization;
  }

  /**
   * Get pull requests for organization
   */
  async getOrganizationPullRequests(refresh = false, state = 'open') {
    const cacheKey = `org_prs_${this.githubOrg}_${state}`;
    
    if (!refresh) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        console.log(`💾 Pull Requests löytyivät cachesta (${cached.length} PR)`);
        return cached;
      }
    }

    console.log(`💾 Haetaan Pull Requests API:sta...`);
    
    try {
      const q = `org:${this.githubOrg} is:pr is:${state}`;
      const { data } = await githubClient.request('GET', '/search/issues', {
        params: {
          q,
          per_page: 100,
          sort: 'updated',
          order: 'desc'
        }
      });

      const pullRequests = Array.isArray(data?.items) ? data.items : [];

      // Cache for 1 hour
      await this.cacheManager.set(cacheKey, pullRequests, 3600000);
      console.log(`💾 Pull Requests tallennettu cacheen (${pullRequests.length} PR)`);

      return pullRequests;
    } catch (error) {
      console.error('❌ Virhe Pull Requests haussa:', error.message);
      return [];
    }
  }

  /**
   * Get pull requests statistics
   */
  getPullRequestsStatistics(pullRequests) {
    const stats = {
      total: pullRequests.length,
      byState: {},
      byRepository: {},
      byDraft: { draft: 0, ready: 0 },
      recentPRs: [],
      mergeable: { mergeable: 0, conflict: 0, unknown: 0 }
    };

    pullRequests.forEach(pr => {
      // Count by state
      const state = pr.state || 'unknown';
      stats.byState[state] = (stats.byState[state] || 0) + 1;

      // Count by repository
      const repoName = pr.repository_url?.split('/').slice(-2).join('/') || 'unknown';
      stats.byRepository[repoName] = (stats.byRepository[repoName] || 0) + 1;

      // Count by draft status
      if (pr.draft) {
        stats.byDraft.draft++;
      } else {
        stats.byDraft.ready++;
      }

      // Count by mergeable status (if available)
      if (pr.mergeable === true) {
        stats.mergeable.mergeable++;
      } else if (pr.mergeable === false) {
        stats.mergeable.conflict++;
      } else {
        stats.mergeable.unknown++;
      }
    });

    // Get recent PRs (sorted by updated_at)
    stats.recentPRs = pullRequests
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
      .slice(0, 50);

    // Top repositories with PRs
    stats.topRepositories = Object.entries(stats.byRepository)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([repo, count]) => ({ repo, count }));

    return stats;
  }
}

module.exports = PullRequestsService;

