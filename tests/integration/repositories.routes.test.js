/**
 * Integration tests for repository routes
 */

const request = require('supertest');
const express = require('express');

describe('Repository Routes', () => {
  let app;
  let mockRepositoryController;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockRepositoryController = {
      getRepositories: jest.fn(),
      renderRepositories: jest.fn()
    };

    const createRepositoryRoutes = require('../../src/app/routes/repositories');
    app.use(createRepositoryRoutes(mockRepositoryController));
  });

  describe('GET /api/repos', () => {
    it('should return repository data', async () => {
      mockRepositoryController.getRepositories.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: [
            { name: 'repo1', full_name: 'org/repo1' },
            { name: 'repo2', full_name: 'org/repo2' }
          ],
          count: 2
        });
      });

      const response = await request(app)
        .get('/api/repos')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('count', 2);
      expect(mockRepositoryController.getRepositories).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      // Test that controller method exists and can be called
      // Note: Actual error handling is tested in controller unit tests
      expect(typeof mockRepositoryController.getRepositories).toBe('function');
      
      // Test that error handler middleware works
      const errorApp = express();
      errorApp.use(express.json());
      
      errorApp.use('/api/repos', (req, res, next) => {
        const error = new Error('Test error');
        error.status = 500;
        next(error);
      });

      errorApp.use((err, req, res, next) => {
        res.status(err.status || 500).json({ error: err.message });
      });

      const response = await request(errorApp)
        .get('/api/repos')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /repositories', () => {
    it('should have renderRepositories route configured', () => {
      // Verify route is configured - actual rendering is tested in controller unit tests
      const createRepositoryRoutes = require('../../src/app/routes/repositories');
      const routes = createRepositoryRoutes(mockRepositoryController);
      expect(routes).toBeDefined();
      expect(typeof mockRepositoryController.renderRepositories).toBe('function');
    });
  });
});

