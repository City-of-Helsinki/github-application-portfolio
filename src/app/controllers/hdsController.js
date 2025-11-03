class HdsController {
  constructor(hdsService) {
    this.hdsService = hdsService;
  }

  async renderHds(req, res, next) {
    try {
      const refresh = req.query.refresh === 'true';
      const { hdsRepos, stats, versionStats, packageStats } = await this.hdsService.getOverview(refresh);

      res.render('hds', {
        title: 'HDS - Helsinki Design System',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        hdsRepos,
        stats,
        versionStats,
        packageStats,
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = HdsController;


