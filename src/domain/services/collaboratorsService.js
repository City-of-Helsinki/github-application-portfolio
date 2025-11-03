/**
 * Service layer for collaborators business logic
 * Handles all collaborators-related operations
 */

const { githubClient } = require('../../integrations/github/client');
const { config } = require('../../core/config');

class CollaboratorsService {
  constructor(cacheManager, repositoryService) {
    this.cacheManager = cacheManager;
    this.repositoryService = repositoryService;
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
   * Get collaborators for a repository
   */
  async getRepositoryCollaborators(ownerLogin, repoName) {
    const cacheKey = `collaborators_${ownerLogin}_${repoName}`;
    
    let collaborators = await this.cacheManager.get(cacheKey);
    
    if (!collaborators) {
      try {
        const { data } = await githubClient.request('GET', `/repos/${ownerLogin}/${repoName}/collaborators`, {
          params: {
            per_page: 100
          }
        });

        collaborators = Array.isArray(data) ? data : [];

        // Cache for 24 hours
        await this.cacheManager.set(cacheKey, collaborators, 86400000);
      } catch (error) {
        console.error(`❌ Virhe collaboratorien haussa reposta ${repoName}:`, error.message);
        return [];
      }
    }

    return collaborators;
  }

  /**
   * Get collaborators statistics
   */
  async getCollaboratorsStatistics(repositories) {
    const stats = {
      totalRepos: repositories.length,
      reposWithCollaborators: 0,
      reposWithoutCollaborators: 0,
      totalCollaborators: 0,
      uniqueCollaborators: new Set(),
      collaboratorsByPermission: {},
      topCollaborators: []
    };

    const reposWithCollaborators = [];
    const batchSize = 5;

    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          const ownerLogin = this.getOwnerLogin(repo);
          const collaborators = await this.getRepositoryCollaborators(ownerLogin, repo.name);
          
          if (collaborators.length > 0) {
            stats.reposWithCollaborators++;
            stats.totalCollaborators += collaborators.length;
            
            collaborators.forEach(collab => {
              stats.uniqueCollaborators.add(collab.login);
              
              // Count permissions
              const permission = collab.permissions?.admin ? 'admin' :
                                collab.permissions?.push ? 'push' :
                                collab.permissions?.pull ? 'pull' : 'unknown';
              
              stats.collaboratorsByPermission[permission] = (stats.collaboratorsByPermission[permission] || 0) + 1;
            });

            return {
              ...repo,
              collaborators: collaborators.map(c => ({
                login: c.login,
                avatar_url: c.avatar_url,
                html_url: c.html_url,
                permission: c.permissions?.admin ? 'admin' :
                          c.permissions?.push ? 'push' :
                          c.permissions?.pull ? 'pull' : 'unknown',
                site_admin: c.site_admin || false,
                type: c.type || 'User'
              }))
            };
          } else {
            stats.reposWithoutCollaborators++;
            return {
              ...repo,
              collaborators: []
            };
          }
        })
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          reposWithCollaborators.push(result.value);
        }
      });

      // Small delay between batches
      if (i + batchSize < repositories.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Calculate top collaborators
    const collaboratorCounts = {};
    reposWithCollaborators.forEach(repo => {
      repo.collaborators?.forEach(collab => {
        collaboratorCounts[collab.login] = (collaboratorCounts[collab.login] || 0) + 1;
      });
    });

    stats.topCollaborators = Object.entries(collaboratorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([login, count]) => ({ login, count }));

    stats.uniqueCollaboratorsCount = stats.uniqueCollaborators.size;

    return {
      repositories: reposWithCollaborators,
      stats
    };
  }
}

module.exports = CollaboratorsService;

