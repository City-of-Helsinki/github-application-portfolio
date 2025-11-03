const axios = require('axios');
const { config } = require('../../core/config');

class DrupalService {
  constructor(cacheManager, repositoryService) {
    this.cacheManager = cacheManager;
    this.repositoryService = repositoryService;
    this.githubApiBase = config.github.baseUrl || 'https://api.github.com';
    this.githubToken = config.github.token;
  }

  async getDrupalVersionForRepo(repo) {
    try {
      if (repo.language !== 'PHP') return null;
      
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
          const requireDev = json['require-dev'] || {};
          
          // Etsi Drupal-core eri muodoista
          let version = require['drupal/core'] || require['drupal/drupal'] || 
                       require['drupal/core-recommended'] || requireDev['drupal/core'];
          
          if (!version && require['drupal/core-dev']) version = require['drupal/core-dev'];
          
          if (version) {
            // Poista version constraints
            version = String(version).replace(/[\^~>=<]+/, '');
            // Poista dev, alpha, beta, rc
            if (version.includes('-')) version = version.split('-')[0];
            // Validointi
            if (!/^\d+\.\d+/.test(version)) return null;
            
            // Normalisoi (9.5.0 -> 9.5)
            const parts = version.split('.');
            if (parts.length === 3 && parts[2] === '0') version = parts.slice(0, 2).join('.');
            else if (parts.length >= 2) version = parts.slice(0, 2).join('.');
            
            // Filtteröi pois versiot < 7.x
            const major = parseInt(version.split('.')[0], 10);
            if (isNaN(major) || major < 7) return null;
            
            return version;
          }
        }
      } catch (_) {}
      
      return null;
    } catch (_) {
      return null;
    }
  }

  async getDrupalOverview(refresh = false) {
    const all = refresh
      ? await this.repositoryService.getRecentRepositories(true, true)
      : await this.repositoryService.getCachedRepositories(true);

    const phpRepos = all.filter(r => r.language === 'PHP');
    const drupalRepos = [];
    const noDrupalRepos = [];

    const batchSize = 10;
    for (let i = 0; i < phpRepos.length; i += batchSize) {
      const batch = phpRepos.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async repo => {
          const v = await this.getDrupalVersionForRepo(repo);
          return { ...repo, drupal_version: v };
        })
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value && r.value.drupal_version) drupalRepos.push(r.value);
        else noDrupalRepos.push(batch[idx]);
      });
      if (i + batchSize < phpRepos.length) await new Promise(r => setTimeout(r, 500));
    }

    const versionStats = {};
    drupalRepos.forEach(repo => {
      versionStats[repo.drupal_version] = (versionStats[repo.drupal_version] || 0) + 1;
    });
    const sortedVersions = Object.entries(versionStats).sort(([,a],[,b]) => b - a).map(([version,count])=>({version,count}));

    return { drupalRepos, noDrupalRepos, versionStats: sortedVersions };
  }
}

module.exports = DrupalService;

