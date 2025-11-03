/**
 * Controller for pull requests-related routes
 * Handles HTTP requests and responses for pull requests operations
 */

const { errorHandler } = require('../../core/errors');

class PullRequestsController {
  constructor(pullRequestsService) {
    this.pullRequestsService = pullRequestsService;
  }

  /**
   * Render pull requests view
   */
  async renderPullRequests(req, res, next) {
    try {
      if (!process.env.GITHUB_TOKEN) {
        return res.render('error', {
          message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
          error: { status: 500 }
        });
      }

      const refresh = req.query.refresh === 'true';
      const state = req.query.state || 'open';
      
      // Get pull requests
      const pullRequests = await this.pullRequestsService.getOrganizationPullRequests(refresh, state);

      // Get statistics
      const stats = this.pullRequestsService.getPullRequestsStatistics(pullRequests);

      res.render('pull_requests', {
        title: 'Pull Requests - Yhdistelmäpyynnöt',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        pullRequests: pullRequests,
        stats: stats,
        currentState: state,
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (error) {
      console.error('❌ Virhe Pull Requests-sivun latauksessa:', error);
      req.logger?.error('pull_requests.error', { message: error.message });
      res.render('error', {
        message: 'Virhe Pull Requests-sivun latauksessa',
        error: { status: 500, stack: error.stack }
      });
    }
  }
}

module.exports = PullRequestsController;

