const express = require('express');
const router = express.Router();

function createReleasesRoutes(releasesController) {
  router.get('/releases', async (req, res, next) => {
    await releasesController.renderReleases(req, res, next);
  });
  return router;
}

module.exports = createReleasesRoutes;

