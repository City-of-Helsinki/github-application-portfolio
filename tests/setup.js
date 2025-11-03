/**
 * Test setup and configuration
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.USE_DATABASE = 'false';
process.env.USE_REDIS = 'false';
process.env.GITHUB_TOKEN = 'test-token';
process.env.GITHUB_ORG = 'test-org';

// Mock GitHub client module to avoid ESM import issues
jest.mock('../src/integrations/github/client', () => ({
  githubClient: {
    getAllPages: jest.fn().mockResolvedValue([]),
    request: jest.fn().mockResolvedValue({ data: [] }),
    rest: {
      repos: {
        listCommits: jest.fn(),
        listCollaborators: jest.fn(),
        listTeams: jest.fn()
      },
      issues: {
        listForRepo: jest.fn(),
        listForOrg: jest.fn()
      },
      pulls: {
        list: jest.fn()
      }
    }
  }
}), { virtual: true });

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test timeout
jest.setTimeout(10000);

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

