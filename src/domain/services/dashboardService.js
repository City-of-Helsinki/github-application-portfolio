class DashboardService {
  constructor(repositoryService) {
    this.repositoryService = repositoryService;
  }

  async getDashboardData(refresh = false) {
    const repositories = refresh
      ? await this.repositoryService.getRecentRepositories(true, true)
      : await this.repositoryService.getCachedRepositories(true);

    // Calculate language counts
    const languageCounts = {};
    repositories.forEach(repo => {
      if (repo.language) {
        languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
      }
    });

    const totalRepos = repositories.length;

    // 1. Security (Dependabot)
    const totalCriticalAlerts = repositories.reduce((sum, repo) => {
      return sum + (repo.dependabot_critical_count || 0);
    }, 0);
    const reposWithAlerts = repositories.filter(repo => (repo.dependabot_critical_count || 0) > 0).length;
    const reposWithoutAlerts = totalRepos - reposWithAlerts;

    // 2. Framework/technology summary
    const djangoRepos = repositories.filter(repo => repo.django_version).length;
    const reactRepos = repositories.filter(repo => repo.react_version).length;
    const drupalRepos = repositories.filter(repo => repo.drupal_version).length;
    const dockerRepos = repositories.filter(repo => repo.docker_base_image).length;

    // 3. Activity statistics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentlyUpdated = repositories.filter(repo => {
      if (!repo.updated_at) return false;
      const updatedDate = new Date(repo.updated_at);
      return updatedDate >= thirtyDaysAgo;
    }).length;

    const archivedRepos = repositories.filter(repo => repo.archived === true).length;
    const activeRepos = totalRepos - archivedRepos;

    // Calculate average days since update
    const daysSinceUpdates = repositories
      .map(repo => {
        if (!repo.updated_at) return null;
        const updatedDate = new Date(repo.updated_at);
        return Math.floor((now - updatedDate) / (1000 * 60 * 60 * 24));
      })
      .filter(days => days !== null);
    const avgDaysSinceUpdate = daysSinceUpdates.length > 0
      ? Math.round(daysSinceUpdates.reduce((a, b) => a + b, 0) / daysSinceUpdates.length)
      : 0;

    // 4. Top repositories
    const topStars = [...repositories]
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
      .slice(0, 5);
    const topForks = [...repositories]
      .sort((a, b) => (b.forks_count || 0) - (a.forks_count || 0))
      .slice(0, 5);
    const topRecent = [...repositories]
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || 0);
        const dateB = new Date(b.updated_at || 0);
        return dateB - dateA;
      })
      .slice(0, 5);

    // 5. Organizations/teams summary
    const reposWithTeams = repositories.filter(repo => {
      let teams = [];
      if (repo.all_teams) {
        if (Array.isArray(repo.all_teams)) {
          teams = repo.all_teams;
        } else if (typeof repo.all_teams === 'string') {
          try {
            teams = JSON.parse(repo.all_teams);
          } catch (e) {
            teams = [];
          }
        }
      }
      return teams && teams.length > 0;
    }).length;
    const reposWithoutTeams = totalRepos - reposWithTeams;

    // Team statistics
    const teamStats = {};
    repositories.forEach(repo => {
      let teams = [];
      if (repo.all_teams) {
        if (Array.isArray(repo.all_teams)) {
          teams = repo.all_teams;
        } else if (typeof repo.all_teams === 'string') {
          try {
            teams = JSON.parse(repo.all_teams || '[]');
          } catch (e) {
            teams = [];
          }
        }
      }
      teams.forEach(team => {
        if (team && typeof team === 'string') {
          teamStats[team] = (teamStats[team] || 0) + 1;
        }
      });
    });
    const topTeams = Object.entries(teamStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // 6. Helsinki Design System usage (simplified - use cache data only)
    const frontendRepos = repositories.filter(repo => 
      ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'SCSS', 'Vue', 'React'].includes(repo.language)
    );
    
    // Note: HDS data would need to be fetched from cache or computed separately
    // For now, we'll use simplified stats
    const hdsReposCount = 0; // Would need separate HDS service to compute
    const topHDSVersions = [];

    // 7. Repository health indicators
    const reposWithDescription = repositories.filter(repo => repo.description && repo.description.trim().length > 0).length;
    const reposWithTopics = repositories.filter(repo => {
      let topics = [];
      if (repo.topics) {
        if (Array.isArray(repo.topics)) {
          topics = repo.topics;
        } else if (typeof repo.topics === 'string') {
          try {
            topics = JSON.parse(repo.topics || '[]');
          } catch (e) {
            topics = [];
          }
        }
      }
      return topics && topics.length > 0;
    }).length;
    const reposWithHomepage = repositories.filter(repo => repo.homepage && repo.homepage.trim().length > 0).length;

    const healthMetrics = {
      withDescription: reposWithDescription,
      withTopics: reposWithTopics,
      withHomepage: reposWithHomepage,
      totalRepos: totalRepos
    };

    return {
      repositories,
      totalRepos,
      languageCounts,
      totalCriticalAlerts,
      reposWithAlerts,
      reposWithoutAlerts,
      djangoRepos,
      reactRepos,
      drupalRepos,
      dockerRepos,
      recentlyUpdated,
      archivedRepos,
      activeRepos,
      avgDaysSinceUpdate,
      topStars,
      topForks,
      topRecent,
      reposWithTeams,
      reposWithoutTeams,
      topTeams,
      hdsReposCount,
      frontendReposCount: frontendRepos.length,
      topHDSVersions,
      healthMetrics
    };
  }
}

module.exports = DashboardService;

