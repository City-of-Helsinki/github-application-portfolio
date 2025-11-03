const express = require('express');
const router = express.Router();

function createDockerRoutes(dockerController) {
  router.get('/dockerfile', async (req, res, next) => {
    await dockerController.renderDockerfile(req, res, next);
  });
  return router;
}

module.exports = createDockerRoutes;


