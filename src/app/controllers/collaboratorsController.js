/**
 * Controller for collaborators-related routes
 * Handles HTTP requests and responses for collaborators operations
 */

const { errorHandler } = require('../../core/errors');

class CollaboratorsController {
  constructor(collaboratorsService, repositoryService) {
    this.collaboratorsService = collaboratorsService;
    this.repositoryService = repositoryService;
  }

  /**
   * Render collaborators view
   */
  async renderCollaborators(req, res, next) {
    try {
      if (!process.env.GITHUB_TOKEN) {
        return res.render('error', {
          message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
          error: { status: 500 }
        });
      }

      const refresh = req.query.refresh === 'true';
      
      // Get repositories
      let repositories;
      if (refresh) {
        repositories = await this.repositoryService.getRecentRepositories(true);
      } else {
        repositories = await this.repositoryService.getCachedRepositories();
      }

      // Filter out archived repositories
      repositories = repositories.filter(repo => !repo.archived);

      // Limit for performance (analyze top 50 repositories)
      const reposToAnalyze = repositories.slice(0, 50);

      // Get collaborators statistics
      const { repositories: reposWithCollaborators, stats } = 
        await this.collaboratorsService.getCollaboratorsStatistics(reposToAnalyze);

      res.render('collaborators', {
        title: 'Collaborators - Yhteistyökumppanit',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        repositories: reposWithCollaborators,
        stats: stats,
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (error) {
      console.error('❌ Virhe Collaborators-sivun latauksessa:', error);
      req.logger?.error('collaborators.error', { message: error.message });
      res.render('error', {
        message: 'Virhe Collaborators-sivun latauksessa',
        error: { status: 500, stack: error.stack }
      });
    }
  }
}

module.exports = CollaboratorsController;

