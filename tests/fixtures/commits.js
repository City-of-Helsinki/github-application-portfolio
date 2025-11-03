/**
 * Test fixtures for commits
 */

module.exports = {
  sampleCommit: {
    sha: 'abc123def456',
    commit: {
      message: 'Test commit message',
      author: {
        name: 'Test User',
        date: '2024-01-01T00:00:00Z'
      }
    },
    author: {
      login: 'test-user'
    }
  },

  multipleCommits: [
    {
      sha: 'abc123',
      commit: {
        message: 'First commit',
        author: { name: 'User1', date: '2024-01-01T00:00:00Z' }
      },
      author: { login: 'user1' }
    },
    {
      sha: 'def456',
      commit: {
        message: 'Second commit',
        author: { name: 'User2', date: '2024-01-02T00:00:00Z' }
      },
      author: { login: 'user2' }
    }
  ]
};

