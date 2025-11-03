/**
 * Controller for commits-related routes
 * Handles HTTP requests and responses for commits operations
 */

const { errorHandler } = require('../../core/errors');

class CommitsController {
  constructor(commitsService, repositoryService) {
    this.commitsService = commitsService;
    this.repositoryService = repositoryService;
  }

  /**
   * Render commits view
   */
  async renderCommits(req, res, next) {
    try {
      if (!process.env.GITHUB_TOKEN) {
        return res.render('error', {
          message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
          error: { status: 500 }
        });
      }

      const refresh = req.query.refresh === 'true';
      req.logger?.info('commits.render.start', { refresh });
      console.log(`📝 Commits: aloitus (refresh=${refresh})`);
      
      // Get repositories
      let repositories;
      if (refresh) {
        repositories = await this.repositoryService.getRecentRepositories(true);
      } else {
        repositories = await this.repositoryService.getCachedRepositories();
      }
      req.logger?.info('commits.render.repos.fetched', { total: repositories?.length || 0 });
      console.log(`📝 Commits: repot haettu (${repositories?.length || 0} kpl)`);

      // Filter out archived repositories
      const beforeFilter = repositories.length;
      repositories = repositories.filter(repo => !repo.archived);
      const afterFilter = repositories.length;
      req.logger?.info('commits.render.repos.filtered', { beforeFilter, afterFilter, archivedFiltered: beforeFilter - afterFilter });
      console.log(`📝 Commits: suodatettu arkistoidut (ennen=${beforeFilter}, jälkeen=${afterFilter})`);

      // Get commit statistics
      const { repositories: reposWithCommits, stats } = await this.commitsService.getCommitStatistics(repositories);
      req.logger?.info('commits.render.stats', {
        reposWithCommits: stats?.reposWithCommits || 0,
        reposWithoutCommits: stats?.reposWithoutCommits || 0,
        topCommitters: stats?.topCommitters ? stats.topCommitters.length : 0,
        recentCommits: stats?.recentCommits ? stats.recentCommits.length : 0
      });
      console.log(`📝 Commits: tilastot (with=${stats?.reposWithCommits || 0}, without=${stats?.reposWithoutCommits || 0}, top=${stats?.topCommitters ? stats.topCommitters.length : 0}, recent=${stats?.recentCommits ? stats.recentCommits.length : 0})`);

      res.render('commits', {
        title: 'Commits - Viimeisimmät commitit',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        repositories: reposWithCommits,
        stats: {
          totalRepos: reposWithCommits.length,
          reposWithCommits: stats.reposWithCommits,
          reposWithoutCommits: stats.reposWithoutCommits,
          topCommitters: stats.topCommitters,
          recentCommits: stats.recentCommits.slice(0, 50) // Top 50 most recent
        },
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
      req.logger?.info('commits.render.done', { renderedRepos: reposWithCommits.length });
      console.log(`📝 Commits: render valmis (repos=${reposWithCommits.length})`);
    } catch (error) {
      console.error('❌ Virhe Commits-sivun latauksessa:', error);
      req.logger?.error('commits.error', { message: error.message });
      res.render('error', {
        message: 'Virhe Commits-sivun latauksessa',
        error: { status: 500, stack: error.stack }
      });
    }
  }
}

module.exports = CommitsController;

