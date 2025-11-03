class DashboardController {
  constructor(dashboardService) {
    this.dashboardService = dashboardService;
  }

  async renderDashboard(req, res, next) {
    try {
      if (!process.env.GITHUB_TOKEN) {
        return res.render('error', {
          message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
          error: { status: 500 }
        });
      }

      const refresh = req.query.refresh === 'true';
      const data = await this.dashboardService.getDashboardData(refresh);

      res.render('dashboard', {
        title: 'Dashboard',
        organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
        repositories: data.repositories,
        totalRepos: data.totalRepos,
        languageCounts: data.languageCounts,
        totalCriticalAlerts: data.totalCriticalAlerts,
        reposWithAlerts: data.reposWithAlerts,
        reposWithoutAlerts: data.reposWithoutAlerts,
        djangoRepos: data.djangoRepos,
        reactRepos: data.reactRepos,
        drupalRepos: data.drupalRepos,
        dockerRepos: data.dockerRepos,
        recentlyUpdated: data.recentlyUpdated,
        archivedRepos: data.archivedRepos,
        activeRepos: data.activeRepos,
        avgDaysSinceUpdate: data.avgDaysSinceUpdate,
        topStars: data.topStars,
        topForks: data.topForks,
        topRecent: data.topRecent,
        reposWithTeams: data.reposWithTeams,
        reposWithoutTeams: data.reposWithoutTeams,
        topTeams: data.topTeams,
        hdsReposCount: data.hdsReposCount,
        frontendReposCount: data.frontendReposCount,
        topHDSVersions: data.topHDSVersions,
        healthMetrics: data.healthMetrics,
        getLanguageColor: req.app.locals.getLanguageColor || (() => '#6c757d')
      });
    } catch (error) {
      console.error('❌ Virhe Dashboard-sivun latauksessa:', error);
      
      if (error.response?.status === 502) {
        res.render('error', {
          message: 'GitHub API on väliaikaisesti poissa käytöstä (502 Bad Gateway). Yritä myöhemmin uudelleen.',
          error: { status: 502 }
        });
      } else {
        res.render('error', {
          message: 'Virhe Dashboard-sivun latauksessa',
          error: { status: 500, stack: error.stack }
        });
      }
    }
  }
}

module.exports = DashboardController;

