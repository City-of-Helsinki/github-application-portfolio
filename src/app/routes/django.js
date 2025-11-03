const express = require('express');
const router = express.Router();

function createDjangoRoutes(djangoController) {
  router.get('/django', async (req, res, next) => {
    await djangoController.renderDjango(req, res, next);
  });
  return router;
}

module.exports = createDjangoRoutes;


