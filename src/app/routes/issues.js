/**
 * Routes for issues operations
 */

const express = require('express');
const router = express.Router();

function createIssuesRoutes(issuesController) {
  /**
   * GET /issues - Render issues view
   */
  router.get('/issues', async (req, res, next) => {
    await issuesController.renderIssues(req, res, next);
  });

  return router;
}

module.exports = createIssuesRoutes;

