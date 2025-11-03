class WordPressController {
  constructor(wordpressService) {
    this.wordpressService = wordpressService;
  }

  async renderWordPress(req, res, next) {
    try {
      const refresh = req.query.refresh === 'true';
      const { wordpressRepos, noWordPressRepos, versionStats } = await this.wordpressService.getWordPressOverview(refresh);

      res.render('wordpress', {
        title: 'WordPress - PHP-sivustot',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        wordpressRepos,
        noWordPressRepos,
        versionStats,
        stats: {
          totalRepos: wordpressRepos.length + noWordPressRepos.length,
          phpRepos: wordpressRepos.length + noWordPressRepos.length,
          wordpressRepos: wordpressRepos.length,
          noWordPressRepos: noWordPressRepos.length,
          uniqueVersions: versionStats.length
        },
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = WordPressController;


