const express = require('express');
const router = express.Router();

function createLanguagesRoutes(languagesController) {
  router.get('/languages', async (req, res, next) => {
    await languagesController.renderLanguages(req, res, next);
  });
  return router;
}

module.exports = createLanguagesRoutes;


