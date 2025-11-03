const express = require('express');
const router = express.Router();

function createContentsRoutes(contentsController) {
  router.get('/contents', async (req, res, next) => {
    await contentsController.renderContents(req, res, next);
  });
  return router;
}

module.exports = createContentsRoutes;

