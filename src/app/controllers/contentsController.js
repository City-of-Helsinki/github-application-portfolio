class ContentsController {
  constructor(contentsService) {
    this.contentsService = contentsService;
  }

  async renderContents(req, res, next) {
    try {
      const org = req.query.org || process.env.GITHUB_ORG || 'City-of-Helsinki';
      const repos = await this.contentsService.getContents(org);
      
      res.render('contents', {
        title: 'Contents',
        repos: repos
      });
    } catch (err) {
      req.logger?.error('view.contents.error', { message: err.message });
      res.render('contents', {
        title: 'Contents',
        repos: []
      });
    }
  }
}

module.exports = ContentsController;

