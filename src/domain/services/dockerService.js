const axios = require('axios');
const { config } = require('../../core/config');
const { githubClient } = require('../../integrations/github/client');

class DockerService {
  constructor(cacheManager, repositoryService) {
    this.cacheManager = cacheManager;
    this.repositoryService = repositoryService;
    this.githubApiBase = config.github.baseUrl || 'https://api.github.com';
    this.githubToken = config.github.token;
  }

  async getSingleDockerfileForRepo(repo) {
    try {
      const ownerLogin = (repo.owner && repo.owner.login) || (repo.full_name ? repo.full_name.split('/')[0] : null);
      if (!ownerLogin || !repo.name) return null;

      const candidatePaths = ['Dockerfile', 'docker/Dockerfile'];
      for (const dockerfilePath of candidatePaths) {
        try {
          const { data } = await axios.get(
            `${this.githubApiBase}/repos/${ownerLogin}/${repo.name}/contents/${dockerfilePath}`,
            { headers: { Authorization: this.githubToken ? `token ${this.githubToken}` : undefined, 'User-Agent': 'Application-Portfolio' } }
          );
          if (data && data.type === 'file' && data.content) {
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            const baseImages = this.extractBaseImages(content, dockerfilePath);
            return { path: dockerfilePath, baseImages };
          }
        } catch (_) {
          // try next candidate
          continue;
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  extractBaseImages(dockerfileContent, dockerfilePath) {
    const images = [];
    const matches = dockerfileContent.match(/^FROM\s+([^\s#\n]+)/gm) || [];
    for (const line of matches) {
      const m = line.match(/^FROM\s+([^\s#\n]+)/);
      if (m && m[1]) images.push({ image: m[1], dockerfile: dockerfilePath });
    }
    return images;
  }

  async getDockerOverview(refresh = false) {
    const repositories = refresh
      ? await this.repositoryService.getRecentRepositories(true, true)
      : await this.repositoryService.getCachedRepositories(true);

    const dockerRepos = [];
    const noDockerRepos = [];

    const batchSize = 10;
    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (repo) => {
          const single = await this.getSingleDockerfileForRepo(repo);
          if (single) {
            const primary = single.baseImages && single.baseImages.length > 0 ? single.baseImages[0].image : null;
            return { ...repo, docker_data: { dockerfiles: [single.path] }, docker_base_image: primary };
          }
          return { ...repo, docker_data: null, docker_base_image: null };
        })
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          const repo = r.value;
          if (repo.docker_data && repo.docker_data.dockerfiles && repo.docker_data.dockerfiles.length > 0) {
            dockerRepos.push(repo);
          } else {
            noDockerRepos.push(batch[idx]);
          }
        } else {
          noDockerRepos.push(batch[idx]);
        }
      });
    }

    const baseImageStats = {};
    dockerRepos.forEach(repo => {
      const baseImage = repo.docker_base_image || 'unknown';
      baseImageStats[baseImage] = (baseImageStats[baseImage] || 0) + 1;
    });

    const sortedBaseImages = Object.entries(baseImageStats)
      .sort(([,a], [,b]) => b - a)
      .map(([image, count]) => ({ image, count }));

    return { dockerRepos, noDockerRepos, baseImageStats: sortedBaseImages };
  }
}

module.exports = DockerService;


