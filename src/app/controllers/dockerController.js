class DockerController {
  constructor(dockerService) {
    this.dockerService = dockerService;
  }

  async renderDockerfile(req, res, next) {
    try {
      const refresh = req.query.refresh === 'true';
      const { dockerRepos, noDockerRepos, baseImageStats } = await this.dockerService.getDockerOverview(refresh);

      res.render('dockerfile', {
        title: 'Dockerfile - Docker Repositoryt',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        dockerRepos,
        noDockerRepos,
        baseImageStats,
        stats: {
          totalRepos: dockerRepos.length + noDockerRepos.length,
          dockerRepos: dockerRepos.length,
          noDockerRepos: noDockerRepos.length,
          uniqueBaseImages: baseImageStats.length
        },
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = DockerController;


