const axios = require('axios');
const { config } = require('../../core/config');

class HdsService {
  constructor(cacheManager, repositoryService) {
    this.cacheManager = cacheManager;
    this.repositoryService = repositoryService;
    this.githubApiBase = config.github.baseUrl || 'https://api.github.com';
    this.githubToken = config.github.token;
  }

  async getHdsDataForRepo(repo) {
    try {
      const owner = (repo.owner && repo.owner.login) || (repo.full_name ? repo.full_name.split('/')[0] : null);
      if (!owner || !repo.name) return null;

      const { data } = await axios.get(`${this.githubApiBase}/repos/${owner}/${repo.name}/contents/package.json`, {
        headers: { Authorization: this.githubToken ? `token ${this.githubToken}` : undefined, 'User-Agent': 'Application-Portfolio' }
      });
      if (!data || data.type !== 'file' || !data.content) return null;

      const content = Buffer.from(data.content, 'base64').toString('utf8');
      const json = JSON.parse(content);
      const deps = { ...(json.dependencies || {}), ...(json.devDependencies || {}) };
      const hdsPackages = Object.keys(deps)
        .filter(name => name.startsWith('@city-of-helsinki/') || name.startsWith('@hds/'))
        .reduce((acc, name) => {
          const cleaned = String(deps[name]).replace(/[\^~>=<]+/, '').split('-')[0];
          acc[name] = cleaned;
          return acc;
        }, {});
      if (Object.keys(hdsPackages).length === 0) return null;
      return { has_hds: true, hds_packages: hdsPackages };
    } catch (_) {
      return null;
    }
  }

  async getOverview(refresh = false) {
    const repositories = refresh
      ? await this.repositoryService.getRecentRepositories(true, true)
      : await this.repositoryService.getCachedRepositories(true);

    const frontendRepos = repositories.filter(repo =>
      ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'SCSS', 'Vue', 'React'].includes(repo.language)
    );

    const hdsRepos = [];
    const batchSize = 10;
    for (let i = 0; i < frontendRepos.length; i += batchSize) {
      const batch = frontendRepos.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(async repo => {
        const hdsData = await this.getHdsDataForRepo(repo);
        return hdsData ? { ...repo, hds_data: hdsData } : null;
      }));
      results.forEach(r => { if (r.status === 'fulfilled' && r.value) hdsRepos.push(r.value); });
      if (i + batchSize < frontendRepos.length) await new Promise(r => setTimeout(r, 500));
    }

    const versionStats = {};
    const packageStats = {};
    hdsRepos.forEach(repo => {
      Object.entries(repo.hds_data.hds_packages).forEach(([pkg, ver]) => {
        versionStats[ver] = (versionStats[ver] || 0) + 1;
        packageStats[pkg] = (packageStats[pkg] || 0) + 1;
      });
    });

    const sortedVersions = Object.entries(versionStats).sort(([,a],[,b]) => b - a).map(([version,count])=>({version,count}));
    const sortedPackages = Object.entries(packageStats).sort(([,a],[,b]) => b - a).map(([packageName,count])=>({packageName,count}));

    return {
      hdsRepos,
      stats: {
        totalRepos: repositories.length,
        frontendRepos: frontendRepos.length,
        hdsRepos: hdsRepos.length,
        totalVersions: sortedVersions.length,
        totalPackages: sortedPackages.length
      },
      versionStats: sortedVersions,
      packageStats: sortedPackages
    };
  }
}

module.exports = HdsService;


