const express = require('express');
const router = express.Router();

function createUsersRoutes(usersController) {
  router.get('/users', async (req, res, next) => {
    await usersController.renderUsers(req, res, next);
  });
  return router;
}

module.exports = createUsersRoutes;

