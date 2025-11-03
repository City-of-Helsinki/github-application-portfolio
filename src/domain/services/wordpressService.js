const axios = require('axios');
const { config } = require('../../core/config');

class WordPressService {
  constructor(cacheManager, repositoryService) {
    this.cacheManager = cacheManager;
    this.repositoryService = repositoryService;
    this.githubApiBase = config.github.baseUrl || 'https://api.github.com';
    this.githubToken = config.github.token;
  }

  async getWordPressVersionForRepo(repo) {
    try {
      const owner = (repo.owner && repo.owner.login) || (repo.full_name ? repo.full_name.split('/')[0] : null);
      if (!owner || !repo.name) return null;

      // composer.json
      try {
        const { data } = await axios.get(`${this.githubApiBase}/repos/${owner}/${repo.name}/contents/composer.json`, {
          headers: { Authorization: this.githubToken ? `token ${this.githubToken}` : undefined, 'User-Agent': 'Application-Portfolio' }
        });
        if (data && data.type === 'file' && data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf8');
          const json = JSON.parse(content);
          const require = json.require || {};
          const version = require['johnpbloch/wordpress-core'] || require['roots/wordpress'];
          if (version) {
            const cleaned = String(version).replace(/[\^~>=<]+/, '').split('-')[0];
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

  async getWordPressOverview(refresh = false) {
    const all = refresh
      ? await this.repositoryService.getRecentRepositories(true, true)
      : await this.repositoryService.getCachedRepositories(true);

    const phpRepos = all.filter(r => r.language === 'PHP');
    const wordpressRepos = [];
    const noWordPressRepos = [];

    const batchSize = 10;
    for (let i = 0; i < phpRepos.length; i += batchSize) {
      const batch = phpRepos.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(async repo => {
        const v = await this.getWordPressVersionForRepo(repo);
        return { ...repo, wordpress_version: v };
      }));
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value && r.value.wordpress_version) wordpressRepos.push(r.value);
        else noWordPressRepos.push(batch[idx]);
      });
    }

    const versionStats = {};
    wordpressRepos.forEach(repo => {
      versionStats[repo.wordpress_version] = (versionStats[repo.wordpress_version] || 0) + 1;
    });
    const sortedVersions = Object.entries(versionStats).sort(([,a],[,b]) => b - a).map(([version,count])=>({version,count}));

    return { wordpressRepos, noWordPressRepos, versionStats: sortedVersions };
  }
}

module.exports = WordPressService;


