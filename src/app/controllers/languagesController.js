class LanguagesController {
  constructor(languagesService) {
    this.languagesService = languagesService;
  }

  async renderLanguages(req, res, next) {
    try {
      const refresh = req.query.refresh === 'true';
      const { repositories, languageCounts, frameworkCounts } = await this.languagesService.getOverview(refresh);

      res.render('languages', {
        title: 'Languages',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        repositories,
        totalRepos: repositories.length,
        languageCounts,
        frameworkCounts,
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = LanguagesController;


