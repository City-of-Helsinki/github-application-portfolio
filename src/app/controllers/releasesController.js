class ReleasesController {
  constructor(releasesService) {
    this.releasesService = releasesService;
  }

  async renderReleases(req, res, next) {
    try {
      const org = req.query.org || process.env.GITHUB_ORG || 'City-of-Helsinki';
      const releases = await this.releasesService.getReleases(org);
      
      res.render('releases', {
        title: 'Releases',
        releases: releases
      });
    } catch (err) {
      req.logger?.error('view.releases.error', { message: err.message });
      res.render('releases', {
        title: 'Releases',
        releases: []
      });
    }
  }
}

module.exports = ReleasesController;

