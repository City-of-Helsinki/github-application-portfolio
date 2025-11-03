/**
 * Routes for repository operations
 */

const express = require('express');
const router = express.Router();

function createRepositoryRoutes(repositoryController) {
  /**
   * GET /api/repos - Get all repositories (JSON API)
   */
  router.get('/api/repos', async (req, res, next) => {
    await repositoryController.getRepositories(req, res, next);
  });

  /**
   * GET /repositories - Render repositories view
   */
  router.get('/repositories', async (req, res, next) => {
    await repositoryController.renderRepositories(req, res, next);
  });

  return router;
}

module.exports = createRepositoryRoutes;

