const { githubClient } = require('../../integrations/github/client');
const { config } = require('../../core/config');

class ContentsService {
  constructor() {
    this.org = config.github.organization || 'City-of-Helsinki';
  }

  async getContents(org = null) {
    const targetOrg = org || this.org;
    try {
      const repos = await githubClient.getAllPages(`/orgs/${targetOrg}/repos`, { perPage: 100, maxPages: 2 });
      const results = [];
      
      for (const r of repos) {
        try {
          const { data } = await githubClient.request('GET', `/repos/${r.owner.login}/${r.name}/contents`, {});
          const items = Array.isArray(data) ? data : [];
          const summary = {
            hasReadme: items.some(i => /README\.md/i.test(i.name)),
            hasLicense: items.some(i => /LICENSE/i.test(i.name)),
            hasDockerfile: items.some(i => i.name === 'Dockerfile'),
            hasPackageJson: items.some(i => i.name === 'package.json'),
            hasRequirementsTxt: items.some(i => i.name === 'requirements.txt'),
            workflows: items.some(i => i.name === '.github'),
            dirs: items.filter(i => i.type === 'dir').length,
            files: items.filter(i => i.type === 'file').length,
          };
          results.push({
            repo: r.name,
            fullName: r.full_name,
            htmlUrl: r.html_url,
            defaultBranch: r.default_branch,
            summary,
            items: items.slice(0, 50).map(i => ({ name: i.name, type: i.type, path: i.path, html_url: i.html_url }))
          });
        } catch (e) {
          console.warn(`Contents fetch failed for ${r.full_name}:`, e.message);
        }
      }
      
      return results;
    } catch (err) {
      console.error('Contents service error:', err.message);
      return [];
    }
  }
}

module.exports = ContentsService;

