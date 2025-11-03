/**
 * Routes for commits operations
 */

const express = require('express');
const router = express.Router();

function createCommitsRoutes(commitsController) {
  /**
   * GET /commits - Render commits view
   */
  router.get('/commits', async (req, res, next) => {
    await commitsController.renderCommits(req, res, next);
  });

  return router;
}

module.exports = createCommitsRoutes;

