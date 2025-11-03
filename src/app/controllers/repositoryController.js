/**
 * Controller for repository-related routes
 * Handles HTTP requests and responses for repository operations
 */

const { errorHandler } = require('../../core/errors');

class RepositoryController {
  constructor(repositoryService) {
    this.repositoryService = repositoryService;
  }

  /**
   * Get all repositories
   */
  async getRepositories(req, res, next) {
    try {
      const refresh = req.query.refresh === 'true';
      
      const repositories = refresh
        ? await this.repositoryService.getRecentRepositories(true)
        : await this.repositoryService.getCachedRepositories();

      res.json({
        success: true,
        data: repositories,
        count: repositories.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Render repositories view
   */
  async renderRepositories(req, res, next) {
    try {
      const refresh = req.query.refresh === 'true';
      
      console.log(`📦 Aloitetaan repositories-sivun lataus (refresh: ${refresh})...`);
      
      // Get repositories from service (uses cache if available and refresh is false)
      // Include archived repositories for the view
      const repositories = refresh
        ? await this.repositoryService.getRecentRepositories(true, true)
        : await this.repositoryService.getCachedRepositories(true);

      console.log(`✅ Repositoryt haettu: ${repositories.length} kpl`);

      // Calculate statistics
      const stats = {
        total: repositories.length,
        totalStars: repositories.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0),
        totalForks: repositories.reduce((sum, repo) => sum + (repo.forks_count || 0), 0),
        active: repositories.filter(repo => !repo.archived).length,
        archived: repositories.filter(repo => repo.archived).length
      };

      // Get unique languages for filter
      const languages = [...new Set(repositories.map(r => r.language).filter(Boolean))].sort();

      // Get getLanguageColor function from app locals or use default
      const getLanguageColor = req.app.locals.getLanguageColor || (() => '#6c757d');

      res.render('repositories', {
        title: 'Repositoryt',
        organization: req.query.org || require('../../core/config').config.github.organization,
        repositories: repositories,
        stats: stats,
        languages: languages,
        getLanguageColor: getLanguageColor
      });
    } catch (error) {
      console.error('❌ Virhe repositories-sivun latauksessa:', error);
      req.logger?.error('view.repositories.error', { message: error.message, stack: error.stack });
      
      res.render('repositories', {
        title: 'Repositoryt',
        organization: req.query.org || require('../../core/config').config.github.organization,
        repositories: [],
        stats: {
          total: 0,
          totalStars: 0,
          totalForks: 0,
          active: 0,
          archived: 0
        },
        languages: [],
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    }
  }
}

module.exports = RepositoryController;

