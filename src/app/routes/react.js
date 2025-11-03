const express = require('express');
const router = express.Router();

function createReactRoutes(reactController) {
  router.get('/react', async (req, res, next) => {
    await reactController.renderReact(req, res, next);
  });
  return router;
}

module.exports = createReactRoutes;


