/**
 * Service layer for issues business logic
 * Handles all issues-related operations
 */

const { githubClient } = require('../../integrations/github/client');
const { config } = require('../../core/config');

class IssuesService {
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
    this.githubOrg = config.github.organization;
  }

  /**
   * Get issues for organization
   */
  async getOrganizationIssues(refresh = false, state = 'open') {
    const cacheKey = `org_issues_${this.githubOrg}_${state}`;
    
    if (!refresh) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        console.log(`💾 Issues löytyivät cachesta (${cached.length} issuea)`);
        return cached;
      }
    }

    console.log(`💾 Haetaan issues API:sta...`);
    
    try {
      const q = `org:${this.githubOrg} is:issue is:${state}`;
      const { data } = await githubClient.request('GET', '/search/issues', {
        params: {
          q,
          per_page: 100,
          sort: 'updated',
          order: 'desc'
        }
      });

      const issues = Array.isArray(data?.items) ? data.items : [];

      // Cache for 1 hour
      await this.cacheManager.set(cacheKey, issues, 3600000);
      console.log(`💾 Issues tallennettu cacheen (${issues.length} issuea)`);

      return issues;
    } catch (error) {
      console.error('❌ Virhe issues haussa:', error.message);
      return [];
    }
  }

  /**
   * Get issues statistics
   */
  getIssuesStatistics(issues) {
    const stats = {
      total: issues.length,
      byState: {},
      byLabel: {},
      byRepository: {},
      recentIssues: []
    };

    issues.forEach(issue => {
      // Count by state
      const state = issue.state || 'unknown';
      stats.byState[state] = (stats.byState[state] || 0) + 1;

      // Count by repository
      const repoName = issue.repository_url?.split('/').slice(-2).join('/') || 'unknown';
      stats.byRepository[repoName] = (stats.byRepository[repoName] || 0) + 1;

      // Count by label
      if (issue.labels && Array.isArray(issue.labels)) {
        issue.labels.forEach(label => {
          const labelName = label.name || label;
          stats.byLabel[labelName] = (stats.byLabel[labelName] || 0) + 1;
        });
      }
    });

    // Get recent issues (sorted by updated_at)
    stats.recentIssues = issues
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
      .slice(0, 50);

    // Top repositories with issues
    stats.topRepositories = Object.entries(stats.byRepository)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([repo, count]) => ({ repo, count }));

    // Top labels
    stats.topLabels = Object.entries(stats.byLabel)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    return stats;
  }
}

module.exports = IssuesService;

