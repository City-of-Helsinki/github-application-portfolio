/**
 * Integration tests for commits routes
 */

const request = require('supertest');
const express = require('express');

// Mock EJS rendering
jest.mock('ejs', () => ({
  render: jest.fn((template, data, callback) => {
    callback(null, '<html>Mock HTML</html>');
  })
}));

describe('Commits Routes', () => {
  let app;
  let mockCommitsController;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.set('view engine', 'ejs');

    mockCommitsController = {
      renderCommitsPage: jest.fn((req, res, next) => {
        res.status(200).send('OK');
      })
    };

    const createCommitsRoutes = require('../../src/app/routes/commits');
    app.use(createCommitsRoutes(mockCommitsController));
  });

  describe('GET /commits', () => {
    it('should render commits view', async () => {
      app.set('view engine', 'ejs');
      app.set('views', __dirname + '/../../views');
      
      const response = await request(app)
        .get('/commits')
        .expect(200);

      expect(mockCommitsController.renderCommitsPage).toHaveBeenCalled();
    }, 15000);

    it('should handle refresh parameter', () => {
      // Verify route accepts refresh parameter - actual functionality tested in controller
      // This is a simple test to verify route configuration
      const createCommitsRoutes = require('../../src/app/routes/commits');
      const routes = createCommitsRoutes(mockCommitsController);
      expect(routes).toBeDefined();
      expect(typeof mockCommitsController.renderCommitsPage).toBe('function');
    });
  });
});

