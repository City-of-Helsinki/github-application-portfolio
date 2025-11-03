const axios = require('axios');
const { config } = require('../../core/config');

class ReactService {
  constructor(cacheManager, repositoryService) {
    this.cacheManager = cacheManager;
    this.repositoryService = repositoryService;
    this.githubApiBase = config.github.baseUrl || 'https://api.github.com';
    this.githubToken = config.github.token;
  }

  async getReactVersionForRepo(repo) {
    try {
      const owner = (repo.owner && repo.owner.login) || (repo.full_name ? repo.full_name.split('/')[0] : null);
      if (!owner || !repo.name) return null;
      // package.json
      try {
        const { data } = await axios.get(`${this.githubApiBase}/repos/${owner}/${repo.name}/contents/package.json`, {
          headers: { Authorization: this.githubToken ? `token ${this.githubToken}` : undefined, 'User-Agent': 'Application-Portfolio' }
        });
        if (data && data.type === 'file' && data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf8');
          const json = JSON.parse(content);
          const deps = { ...(json.dependencies||{}), ...(json.devDependencies||{}) };
          const v = deps['react'] || null;
          if (v) {
            const cleaned = String(v).replace(/[\^~>=<]+/, '').split('-')[0];
            const m = cleaned.match(/^(\d+\.\d+(?:\.\d+)?)/);
            if (m) return this.normalizeVersion(m[1]);
          }
        }
      } catch (_) {}
      return null;
    } catch (_) {
      return null;
    }
  }

  normalizeVersion(v) {
    if (!v) return null;
    const parts = v.split('.');
    if (parts.length === 3 && parts[2] === '0') return parts.slice(0, 2).join('.');
    return parts.length >= 2 ? parts.slice(0, 2).join('.') : v;
  }

  async getReactOverview(refresh = false) {
    const all = refresh
      ? await this.repositoryService.getRecentRepositories(true, true)
      : await this.repositoryService.getCachedRepositories(true);

    const jsRepos = all.filter(r => r.language === 'JavaScript' || r.language === 'TypeScript');
    const reactRepos = [];
    const noReactRepos = [];

    const batchSize = 10;
    for (let i = 0; i < jsRepos.length; i += batchSize) {
      const batch = jsRepos.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(async repo => {
        const v = await this.getReactVersionForRepo(repo);
        return { ...repo, react_version: v };
      }));
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value && r.value.react_version) reactRepos.push(r.value);
        else noReactRepos.push(batch[idx]);
      });
      if (i + batchSize < jsRepos.length) await new Promise(r => setTimeout(r, 500));
    }

    const versionStats = {};
    reactRepos.forEach(repo => { versionStats[repo.react_version] = (versionStats[repo.react_version] || 0) + 1; });
    const sortedVersions = Object.entries(versionStats).sort(([,a],[,b]) => b - a).map(([version,count]) => ({ version, count }));

    return { reactRepos, noReactRepos, versionStats: sortedVersions };
  }
}

module.exports = ReactService;


