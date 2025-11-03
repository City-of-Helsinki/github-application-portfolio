class ReactController {
  constructor(reactService) {
    this.reactService = reactService;
  }

  async renderReact(req, res, next) {
    try {
      const refresh = req.query.refresh === 'true';
      const { reactRepos, noReactRepos, versionStats } = await this.reactService.getReactOverview(refresh);

      res.render('react', {
        title: 'React - JavaScript-sovellukset',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        reactRepos,
        noReactRepos,
        versionStats,
        stats: {
          totalRepos: reactRepos.length + noReactRepos.length,
          jsRepos: reactRepos.length + noReactRepos.length,
          reactRepos: reactRepos.length,
          noReactRepos: noReactRepos.length,
          uniqueVersions: versionStats.length
        },
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ReactController;


