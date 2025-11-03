/**
 * Test fixtures for repositories
 */

module.exports = {
  sampleRepository: {
    id: 1,
    name: 'test-repo',
    full_name: 'test-org/test-repo',
    description: 'A test repository',
    html_url: 'https://github.com/test-org/test-repo',
    clone_url: 'https://github.com/test-org/test-repo.git',
    language: 'JavaScript',
    languages: { JavaScript: 1000, TypeScript: 500 },
    stargazers_count: 10,
    forks_count: 5,
    updated_at: '2024-01-01T00:00:00Z',
    created_at: '2023-01-01T00:00:00Z',
    topics: ['test', 'example'],
    archived: false,
    owner: { login: 'test-org' }
  },

  multipleRepositories: [
    {
      name: 'repo1',
      full_name: 'org/repo1',
      language: 'JavaScript',
      stargazers_count: 10,
      archived: false
    },
    {
      name: 'repo2',
      full_name: 'org/repo2',
      language: 'TypeScript',
      stargazers_count: 20,
      archived: false
    },
    {
      name: 'repo3',
      full_name: 'org/repo3',
      language: 'Python',
      stargazers_count: 5,
      archived: true
    }
  ]
};

