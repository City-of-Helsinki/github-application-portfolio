/**
 * Test fixtures for teams
 */

module.exports = {
  sampleTeam: {
    id: 1,
    name: 'Test Team',
    slug: 'test-team',
    description: 'A test team',
    members_count: 5,
    repos_count: 10,
    privacy: 'closed'
  },

  multipleTeams: [
    {
      id: 1,
      name: 'Team Alpha',
      slug: 'team-alpha',
      members_count: 3,
      repos_count: 5
    },
    {
      id: 2,
      name: 'Team Beta',
      slug: 'team-beta',
      members_count: 7,
      repos_count: 12
    }
  ]
};

