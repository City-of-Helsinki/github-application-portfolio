const { githubClient } = require('../../integrations/github/client');
const { config } = require('../../core/config');

class ReleasesService {
  constructor() {
    this.org = config.github.organization || 'City-of-Helsinki';
  }

  async getReleases(org = null) {
    const targetOrg = org || this.org;
    try {
      const repos = await githubClient.getAllPages(`/orgs/${targetOrg}/repos`, { perPage: 100, maxPages: 2 });
      const all = [];
      
      for (const r of repos) {
        try {
          const releases = await githubClient.request('GET', `/repos/${r.owner.login}/${r.name}/releases`, { params: { per_page: 5 } });
          (releases.data || []).forEach(x => all.push({ repo: r.name, ...x }));
        } catch (_) {
          // Ignore repos without releases
        }
      }
      
      return all;
    } catch (err) {
      console.error('Releases service error:', err.message);
      return [];
    }
  }
}

module.exports = ReleasesService;

