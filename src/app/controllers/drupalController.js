class DrupalController {
  constructor(drupalService) {
    this.drupalService = drupalService;
  }

  async renderDrupal(req, res, next) {
    try {
      const refresh = req.query.refresh === 'true';
      const { drupalRepos, noDrupalRepos, versionStats } = await this.drupalService.getDrupalOverview(refresh);

      res.render('drupal', {
        title: 'Drupal - PHP-sivustot',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        drupalRepos,
        noDrupalRepos,
        versionStats,
        stats: {
          totalRepos: drupalRepos.length + noDrupalRepos.length,
          phpRepos: drupalRepos.length + noDrupalRepos.length,
          drupalRepos: drupalRepos.length,
          noDrupalRepos: noDrupalRepos.length,
          uniqueVersions: versionStats.length
        },
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = DrupalController;

