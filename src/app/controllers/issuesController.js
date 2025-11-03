/**
 * Controller for issues-related routes
 * Handles HTTP requests and responses for issues operations
 */

const { errorHandler } = require('../../core/errors');

class IssuesController {
  constructor(issuesService) {
    this.issuesService = issuesService;
  }

  /**
   * Render issues view
   */
  async renderIssues(req, res, next) {
    try {
      if (!process.env.GITHUB_TOKEN) {
        return res.render('error', {
          message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
          error: { status: 500 }
        });
      }

      const refresh = req.query.refresh === 'true';
      const state = req.query.state || 'open';
      
      // Get issues
      const issues = await this.issuesService.getOrganizationIssues(refresh, state);

      // Get statistics
      const stats = this.issuesService.getIssuesStatistics(issues);

      res.render('issues', {
        title: 'Issues - Ongelmat',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        issues: issues,
        stats: stats,
        currentState: state,
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (error) {
      console.error('❌ Virhe Issues-sivun latauksessa:', error);
      req.logger?.error('issues.error', { message: error.message });
      res.render('error', {
        message: 'Virhe Issues-sivun latauksessa',
        error: { status: 500, stack: error.stack }
      });
    }
  }
}

module.exports = IssuesController;

