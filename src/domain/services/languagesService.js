class LanguagesService {
  constructor(repositoryService) {
    this.repositoryService = repositoryService;
  }

  async getOverview(refresh = false) {
    const repositories = refresh
      ? await this.repositoryService.getRecentRepositories(true, true)
      : await this.repositoryService.getCachedRepositories(true);

    const languageCounts = { PHP: 0, JavaScript: 0, Python: 0, Java: 0 };
    const frameworkCounts = { React: 0, Django: 0, Drupal: 0, WordPress: 0 };

    for (const repo of repositories) {
      const lang = repo.language;
      const repoName = (repo.name || '').toLowerCase();

      if (lang === 'PHP') languageCounts.PHP++;
      else if (lang === 'JavaScript' || lang === 'TypeScript') languageCounts.JavaScript++;
      else if (lang === 'Python') languageCounts.Python++;
      else if (lang === 'Java') languageCounts.Java++;

      if (repo.react_version || repoName.includes('react')) frameworkCounts.React++;
      if (repo.django_version || repoName.includes('django')) frameworkCounts.Django++;
      if (repo.drupal_version || repoName.includes('drupal')) frameworkCounts.Drupal++;
      if (repoName.includes('wordpress') || repoName.includes('wp')) frameworkCounts.WordPress++;
    }

    return { repositories, languageCounts, frameworkCounts };
  }
}

module.exports = LanguagesService;


