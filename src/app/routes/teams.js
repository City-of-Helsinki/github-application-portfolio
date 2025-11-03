/**
 * Routes for teams operations
 */

const express = require('express');
const router = express.Router();

function createTeamsRoutes(teamsController) {
  /**
   * GET /teams - Render teams view
   */
  router.get('/teams', async (req, res, next) => {
    await teamsController.renderTeams(req, res, next);
  });

  /**
   * GET /api/teams/:slug - Get team details
   */
  router.get('/api/teams/:slug', async (req, res, next) => {
    await teamsController.getTeamDetails(req, res, next);
  });

  return router;
}

module.exports = createTeamsRoutes;

