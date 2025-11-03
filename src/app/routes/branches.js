const express = require('express');
const router = express.Router();

function createBranchesRoutes(branchesController) {
  router.get('/branches', async (req, res, next) => {
    await branchesController.renderBranches(req, res, next);
  });
  return router;
}

module.exports = createBranchesRoutes;

