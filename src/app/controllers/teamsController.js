/**
 * Controller for teams-related routes
 * Handles HTTP requests and responses for teams operations
 */

const { errorHandler } = require('../../core/errors');

class TeamsController {
  constructor(teamsService, repositoryService) {
    this.teamsService = teamsService;
    this.repositoryService = repositoryService;
  }

  /**
   * Render teams view
   */
  async renderTeams(req, res, next) {
    try {
      if (!process.env.GITHUB_TOKEN) {
        return res.render('error', {
          message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
          error: { status: 500 }
        });
      }

      const refresh = req.query.refresh === 'true';
      
      // Get teams
      const teams = await this.teamsService.getAllTeams(refresh);

      // Get repositories for statistics
      let repositories;
      if (refresh) {
        repositories = await this.repositoryService.getRecentRepositories(true);
      } else {
        repositories = await this.repositoryService.getCachedRepositories();
      }

      // Get teams statistics
      const { teams: enrichedTeams, stats } = await this.teamsService.getTeamsStatistics(teams, repositories);

      res.render('teams', {
        title: 'Teams - Tiimit',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        teams: enrichedTeams,
        stats: stats,
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (error) {
      console.error('❌ Virhe Teams-sivun latauksessa:', error);
      req.logger?.error('teams.error', { message: error.message });
      res.render('error', {
        message: 'Virhe Teams-sivun latauksessa',
        error: { status: 500, stack: error.stack }
      });
    }
  }

  /**
   * Get team details (members and repositories)
   */
  async getTeamDetails(req, res, next) {
    try {
      const teamSlug = req.params.slug;
      
      const [members, repos] = await Promise.all([
        this.teamsService.getTeamMembers(teamSlug),
        this.teamsService.getTeamRepositories(teamSlug)
      ]);

      res.json({
        success: true,
        data: {
          members,
          repositories: repos,
          memberCount: members.length,
          repoCount: repos.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TeamsController;

