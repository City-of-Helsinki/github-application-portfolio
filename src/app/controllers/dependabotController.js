class DependabotController {
  constructor(dependabotService) {
    this.dependabotService = dependabotService;
  }

  async renderDependabot(req, res, next) {
    try {
      const refresh = req.query.refresh === 'true';
      req.logger?.info('dependabot.render.start', { refresh });
      console.log(`🛡️ Dependabot: aloitus (refresh=${refresh})`);

      const { reposWithAlerts, reposWithoutAlerts, teams, stats } = await this.dependabotService.getOverview(refresh);

      req.logger?.info('dependabot.render.data', {
        reposWithAlerts: reposWithAlerts?.length || 0,
        reposWithoutAlerts: reposWithoutAlerts?.length || 0,
        teams: teams?.length || 0,
        totalCriticalAlerts: stats?.totalCriticalAlerts || 0,
        totalRepos: stats?.totalRepos || 0
      });
      console.log(`🛡️ Dependabot: data haettu (with=${reposWithAlerts?.length || 0}, without=${reposWithoutAlerts?.length || 0}, teams=${teams?.length || 0}, critical=${stats?.totalCriticalAlerts || 0}, total=${stats?.totalRepos || 0})`);

      if (reposWithAlerts && reposWithAlerts.length > 0) {
        console.log(`🛡️ Dependabot: repositoriit ilmoituksilla (top 5):`);
        reposWithAlerts.slice(0, 5).forEach(repo => {
          console.log(`   - ${repo.name}: ${repo.dependabot_critical_count} kriittistä ilmoitusta`);
        });
      }

      res.render('dependabot', {
        title: 'Dependabot - Turvallisuusilmoitukset',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        reposWithAlerts,
        reposWithoutAlerts,
        teams,
        stats,
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });

      req.logger?.info('dependabot.render.done');
      console.log(`🛡️ Dependabot: render valmis`);
    } catch (err) {
      console.error('❌ Dependabot: virhe renderöinnissä:', err);
      req.logger?.error('dependabot.render.error', { message: err.message, stack: err.stack });
      next(err);
    }
  }
}

module.exports = DependabotController;


