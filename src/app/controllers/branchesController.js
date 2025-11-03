class BranchesController {
  constructor(branchesService) {
    this.branchesService = branchesService;
  }

  async renderBranches(req, res, next) {
    try {
      const org = req.query.org || process.env.GITHUB_ORG || 'City-of-Helsinki';
      const repos = await this.branchesService.getBranches(org);
      
      res.render('branches', {
        title: 'Branches',
        repos: repos
      });
    } catch (err) {
      req.logger?.error('view.branches.error', { message: err.message });
      res.render('branches', {
        title: 'Branches',
        repos: []
      });
    }
  }
}

module.exports = BranchesController;

