const express = require('express');
const router = express.Router();

function createDashboardRoutes(dashboardController) {
  router.get('/dashboard', async (req, res, next) => {
    await dashboardController.renderDashboard(req, res, next);
  });
  return router;
}

module.exports = createDashboardRoutes;

