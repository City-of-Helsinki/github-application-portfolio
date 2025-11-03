const express = require('express');
const router = express.Router();

function createHdsRoutes(hdsController) {
  router.get('/hds', async (req, res, next) => {
    await hdsController.renderHds(req, res, next);
  });
  return router;
}

module.exports = createHdsRoutes;


