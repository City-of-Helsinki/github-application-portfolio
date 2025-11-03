/**
 * Service layer for repository business logic
 * Handles all repository-related operations
 */

const { githubClient } = require('../../integrations/github/client');
const { config } = require('../../core/config');

class RepositoryService {
  constructor(repositoryRepository, cacheRepository, cacheManager) {
    this.repositoryRepository = repositoryRepository;
    this.cacheRepository = cacheRepository;
    this.cacheManager = cacheManager;
    this.githubOrg = config.github.organization;
  }

  /**
   * Get owner login from repository
   */
  getOwnerLogin(repo) {
    if (!repo || !repo.owner || !repo.owner.login) {
      return this.githubOrg;
    }
    return repo.owner.login;
  }

  /**
   * Get all repositories for organization
   * Fetches from API or cache as appropriate
   * @param {boolean} refresh - Force refresh from API
   * @param {boolean} includeArchived - Include archived repositories
   */
  async getRecentRepositories(refresh = false, includeArchived = false) {
    const reposCacheKey = `org_repos_${this.githubOrg}`;
    
    if (!refresh) {
      const cached = await this.cacheManager.get(reposCacheKey);
      if (cached) {
        console.log(`💾 Repository lista löytyi cachesta (${cached.length} reposta)`);
        const enriched = await this._enrichRepositories(cached);
        if (includeArchived) {
          return enriched;
        }
        // Filter out archived if not included
        const active = enriched.filter(repo => !repo.archived);
        console.log(`🗃️ Arkistoitu suodatettu pois: ${enriched.length - active.length} reposta`);
        return active;
      }
    }

    console.log(`💾 Repository lista ei löytynyt cachesta, haetaan API:sta...`);
    
    const maxRepos = config.app.maxRepositories;
    const allRepos = [];
    let page = 1;

    while (true) {
      // Check MAX_REPOSITORIES limit before fetching
      if (maxRepos && maxRepos > 0 && allRepos.length >= maxRepos) {
        console.log(`🧪 MAX_REPOSITORIES (${maxRepos}) saavutettu, lopetetaan haku`);
        break;
      }

      console.log(`📄 Haetaan sivu ${page}...`);
      
      // Use request() for single page, not getAllPages() which pages through all results
      const { data } = await githubClient.request('GET', `/orgs/${this.githubOrg}/repos`, {
        params: {
          per_page: 100,
          page: page,
          type: 'all',
          sort: 'updated',
          direction: 'desc'
        }
      });

      const response = Array.isArray(data) ? data : [];

      if (!response || response.length === 0) {
        break;
      }

      // Calculate how many we can add without exceeding MAX_REPOSITORIES
      let reposToAdd = response;
      if (maxRepos && maxRepos > 0) {
        const remaining = maxRepos - allRepos.length;
        if (remaining <= 0) {
          console.log(`🧪 MAX_REPOSITORIES (${maxRepos}) saavutettu, lopetetaan haku`);
          break;
        }
        if (response.length > remaining) {
          reposToAdd = response.slice(0, remaining);
          console.log(`🧪 MAX_REPOSITORIES raja: lisätään vain ${remaining}/${response.length} reposta`);
        }
      }

      allRepos.push(...reposToAdd);
      console.log(`✅ Sivu ${page}: ${reposToAdd.length} reposta lisätty (yhteensä: ${allRepos.length}${maxRepos && maxRepos > 0 ? ` / ${maxRepos} max` : ''})`);

      // Stop if we've reached MAX_REPOSITORIES
      if (maxRepos && maxRepos > 0 && allRepos.length >= maxRepos) {
        console.log(`🧪 MAX_REPOSITORIES (${maxRepos}) saavutettu, lopetetaan haku`);
        break;
      }

      // Stop if this was the last page (fewer than 100 results)
      if (response.length < 100) {
        console.log(`🏁 Viimeinen sivu saavutettu`);
        break;
      }

      page += 1;
    }

    // Cache the repository list for 1 hour
    await this.cacheManager.set(reposCacheKey, allRepos, 3600000);
    console.log(`💾 Repository lista tallennettu cacheen (${allRepos.length} reposta)`);

    // Filter out archived repositories if not included
    const archivedCount = allRepos.filter(repo => repo.archived).length;
    const reposToReturn = includeArchived ? allRepos : allRepos.filter(repo => !repo.archived);
    console.log(`🗃️ Arkistoitu: ${archivedCount}, ${includeArchived ? 'Kaikki' : 'Aktiivinen'}: ${reposToReturn.length}`);

    // MAX_REPOSITORIES is already applied during fetch, but add safety check here too
    if (maxRepos && maxRepos > 0 && reposToReturn.length > maxRepos) {
      const limited = reposToReturn.slice(0, maxRepos);
      console.log(`🧪 MAX_REPOSITORIES: rajoitettu ${reposToReturn.length} → ${limited.length} repositoryyn`);
      return this._enrichRepositories(limited);
    }

    return this._enrichRepositories(reposToReturn);
  }

  /**
   * Enrich repositories with additional data
   */
  async _enrichRepositories(repositories) {
    console.log(`🔧 Rikastetaan ${repositories.length} reposta...`);
    
    const reposWithDetails = [];
    const batchSize = 10;

    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      console.log(`📦 Käsitellään batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(repositories.length/batchSize)}`);

      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          try {
            // Get languages
            const languagesCacheKey = `repo:${repo.name}:languages`;
            let languagesData = await this.cacheManager.get(languagesCacheKey);

            if (!languagesData) {
              const ownerLogin = this.getOwnerLogin(repo);
              const requestKey = `languages_${ownerLogin}_${repo.name}`;
              
              languagesData = await this.cacheManager.deduplicateRequest(requestKey, async () => {
                const { data } = await githubClient.request('GET', `/repos/${ownerLogin}/${repo.name}/languages`, {});
                return data || {};
              });
              
              await this.cacheManager.set(languagesCacheKey, languagesData, 86400000); // 24h cache
            }

            return {
              name: repo.name,
              full_name: repo.full_name,
              description: repo.description,
              html_url: repo.html_url,
              clone_url: repo.clone_url,
              homepage: repo.homepage,
              language: repo.language,
              languages: languagesData,
              stargazers_count: repo.stargazers_count || 0,
              forks_count: repo.forks_count || 0,
              updated_at: repo.updated_at,
              created_at: repo.created_at,
              archived: repo.archived || false,
              topics: repo.topics || [],
              readme: null,
              docker_base_image: null,
              django_version: null,
              react_version: null,
              drupal_version: null,
              dependabot_critical_count: 0
            };
          } catch (error) {
            console.error(`❌ Virhe repon ${repo.name} tietojen haussa:`, error.message);
            return {
              name: repo.name,
              full_name: repo.full_name,
              description: repo.description,
              html_url: repo.html_url,
              clone_url: repo.clone_url,
              homepage: repo.homepage,
              language: repo.language,
              languages: {},
              stargazers_count: repo.stargazers_count || 0,
              forks_count: repo.forks_count || 0,
              updated_at: repo.updated_at,
              created_at: repo.created_at,
              archived: repo.archived || false,
              topics: repo.topics || []
            };
          }
        })
      );

      const successfulResults = batchResults
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);

      reposWithDetails.push(...successfulResults);

      // Save to database
      for (const repo of successfulResults) {
        await this.repositoryRepository.saveRepository(repo);
      }

      // Small delay between batches
      if (i + batchSize < repositories.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`✅ Rikastus valmis: ${reposWithDetails.length} reposta`);
    return reposWithDetails;
  }

  /**
   * Get repositories from cache/database
   * @param {boolean} includeArchived - Include archived repositories
   */
  async getCachedRepositories(includeArchived = true) {
    // First try database
    const repos = await this.repositoryRepository.getAllRepositories();
    
    if (repos.length > 0) {
      // Filter archived if not included
      if (!includeArchived) {
        return repos.filter(repo => !repo.archived);
      }
      return repos;
    }

    // Fallback to API if database is empty
    return this.getRecentRepositories(false, includeArchived);
  }
}

module.exports = RepositoryService;

