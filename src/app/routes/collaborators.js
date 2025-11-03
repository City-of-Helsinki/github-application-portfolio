/**
 * Routes for collaborators operations
 */

const express = require('express');
const router = express.Router();

function createCollaboratorsRoutes(collaboratorsController) {
  /**
   * GET /collaborators - Render collaborators view
   */
  router.get('/collaborators', async (req, res, next) => {
    await collaboratorsController.renderCollaborators(req, res, next);
  });

  return router;
}

module.exports = createCollaboratorsRoutes;

