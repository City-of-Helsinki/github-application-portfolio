const { githubClient } = require('../../integrations/github/client');
const { config } = require('../../core/config');

class BranchesService {
  constructor() {
    this.org = config.github.organization || 'City-of-Helsinki';
  }

  async getBranches(org = null) {
    const targetOrg = org || this.org;
    try {
      const repos = await githubClient.getAllPages(`/orgs/${targetOrg}/repos`, { perPage: 100, maxPages: 2 });
      const results = [];
      
      for (const r of repos) {
        try {
          const branches = await githubClient.getAllPages(`/repos/${r.owner.login}/${r.name}/branches`, { perPage: 100, maxPages: 1 });
          results.push({
            repo: r.name,
            fullName: r.full_name,
            defaultBranch: r.default_branch,
            branchCount: branches.length,
            branches: branches.map(b => ({ name: b.name, protected: !!b.protected })),
            htmlUrl: r.html_url
          });
        } catch (e) {
          console.warn(`Branches fetch failed for ${r.full_name}:`, e.message);
        }
      }
      
      return results;
    } catch (err) {
      console.error('Branches service error:', err.message);
      return [];
    }
  }
}

module.exports = BranchesService;

