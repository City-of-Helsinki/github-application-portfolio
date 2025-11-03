const express = require('express');
const router = express.Router();

function createDependabotRoutes(dependabotController) {
  router.get('/dependabot', async (req, res, next) => {
    await dependabotController.renderDependabot(req, res, next);
  });
  return router;
}

module.exports = createDependabotRoutes;


