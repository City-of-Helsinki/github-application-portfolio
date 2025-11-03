const { githubClient } = require('../../integrations/github/client');
const { config } = require('../../core/config');

class UsersService {
  constructor() {
    this.org = config.github.organization || 'City-of-Helsinki';
  }

  async getUsers(org = null) {
    const targetOrg = org || this.org;
    try {
      const members = await githubClient.getAllPages(`/orgs/${targetOrg}/members`, { perPage: 100, maxPages: 5 });
      return members || [];
    } catch (err) {
      console.error('Users fetch error:', err.message);
      return [];
    }
  }
}

module.exports = UsersService;

