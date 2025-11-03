/**
 * Routes for pull requests operations
 */

const express = require('express');
const router = express.Router();

function createPullRequestsRoutes(pullRequestsController) {
  /**
   * GET /pull-requests - Render pull requests view
   * GET /pull_requests - Alternative route (legacy compatibility)
   */
  router.get('/pull-requests', async (req, res, next) => {
    await pullRequestsController.renderPullRequests(req, res, next);
  });
  
  router.get('/pull_requests', async (req, res, next) => {
    await pullRequestsController.renderPullRequests(req, res, next);
  });

  return router;
}

module.exports = createPullRequestsRoutes;

