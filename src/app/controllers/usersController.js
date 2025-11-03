class UsersController {
  constructor(usersService) {
    this.usersService = usersService;
  }

  async renderUsers(req, res, next) {
    try {
      const org = req.query.org || process.env.GITHUB_ORG || 'City-of-Helsinki';
      const users = await this.usersService.getUsers(org);
      
      res.render('users', {
        title: 'Users',
        users: users
      });
    } catch (err) {
      req.logger?.error('view.users.error', { message: err.message });
      res.render('users', {
        title: 'Users',
        users: []
      });
    }
  }
}

module.exports = UsersController;

