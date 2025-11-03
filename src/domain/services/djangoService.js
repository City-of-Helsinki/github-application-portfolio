const axios = require('axios');
const { config } = require('../../core/config');

class DjangoService {
  constructor(cacheManager, repositoryService) {
    this.cacheManager = cacheManager;
    this.repositoryService = repositoryService;
    this.githubApiBase = config.github.baseUrl || 'https://api.github.com';
    this.githubToken = config.github.token;
  }

  async getDjangoVersionForRepo(repo) {
    try {
      const owner = (repo.owner && repo.owner.login) || (repo.full_name ? repo.full_name.split('/')[0] : null);
      if (!owner || !repo.name) return null;

      // requirements.txt
      const reqPaths = ['requirements.txt', 'backend/requirements.txt', 'app/requirements.txt'];
      for (const p of reqPaths) {
        try {
          const { data } = await axios.get(`${this.githubApiBase}/repos/${owner}/${repo.name}/contents/${p}`, {
            headers: { Authorization: this.githubToken ? `token ${this.githubToken}` : undefined, 'User-Agent': 'Application-Portfolio' }
          });
          if (data && data.type === 'file' && data.content) {
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            const line = content.split(/\r?\n/).find(l => /^django(==|>=|~=)/i.test(l));
            if (line) {
              const m = line.match(/django(?:==|>=|~=)([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i);
              if (m) return this.normalizeVersion(m[1]);
            }
          }
        } catch (_) {}
      }

      // pyproject.toml
      try {
        const { data } = await axios.get(`${this.githubApiBase}/repos/${owner}/${repo.name}/contents/pyproject.toml`, {
          headers: { Authorization: this.githubToken ? `token ${this.githubToken}` : undefined, 'User-Agent': 'Application-Portfolio' }
        });
        if (data && data.type === 'file' && data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf8');
          const m = content.match(/django\s*=\s*"([0-9]+\.[0-9]+(?:\.[0-9]+)?)"/i);
          if (m) return this.normalizeVersion(m[1]);
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

  async getDjangoOverview(refresh = false) {
    const all = refresh
      ? await this.repositoryService.getRecentRepositories(true, true)
      : await this.repositoryService.getCachedRepositories(true);

    const pythonRepos = all.filter(r => r.language === 'Python');
    const djangoRepos = [];
    const noDjangoRepos = [];

    const batchSize = 10;
    for (let i = 0; i < pythonRepos.length; i += batchSize) {
      const batch = pythonRepos.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(async repo => {
        const v = await this.getDjangoVersionForRepo(repo);
        return { ...repo, django_version: v };
      }));
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value && r.value.django_version) djangoRepos.push(r.value);
        else noDjangoRepos.push(batch[idx]);
      });
    }

    const versionStats = {};
    djangoRepos.forEach(repo => {
      versionStats[repo.django_version] = (versionStats[repo.django_version] || 0) + 1;
    });
    const sortedVersions = Object.entries(versionStats).sort(([,a],[,b]) => b - a).map(([version,count])=>({version,count}));

    return { djangoRepos, noDjangoRepos, versionStats: sortedVersions };
  }
}

module.exports = DjangoService;


