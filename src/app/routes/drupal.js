const express = require('express');
const router = express.Router();

function createDrupalRoutes(drupalController) {
  router.get('/drupal', async (req, res, next) => {
    await drupalController.renderDrupal(req, res, next);
  });
  return router;
}

module.exports = createDrupalRoutes;

