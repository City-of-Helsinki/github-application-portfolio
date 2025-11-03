const express = require('express');
const router = express.Router();

function createWordPressRoutes(wordpressController) {
  router.get('/wordpress', async (req, res, next) => {
    await wordpressController.renderWordPress(req, res, next);
  });
  return router;
}

module.exports = createWordPressRoutes;


