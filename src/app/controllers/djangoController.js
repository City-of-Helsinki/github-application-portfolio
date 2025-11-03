class DjangoController {
  constructor(djangoService) {
    this.djangoService = djangoService;
  }

  async renderDjango(req, res, next) {
    try {
      const refresh = req.query.refresh === 'true';
      const { djangoRepos, noDjangoRepos, versionStats } = await this.djangoService.getDjangoOverview(refresh);

      res.render('django', {
        title: 'Django - Python-sovellukset',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        djangoRepos,
        noDjangoRepos,
        versionStats,
        stats: {
          totalRepos: djangoRepos.length + noDjangoRepos.length,
          pythonRepos: djangoRepos.length + noDjangoRepos.length,
          djangoRepos: djangoRepos.length,
          noDjangoRepos: noDjangoRepos.length,
          uniqueVersions: versionStats.length
        },
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = DjangoController;


