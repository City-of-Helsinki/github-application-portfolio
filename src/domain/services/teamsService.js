/**
 * Service layer for teams business logic
 * Handles all teams-related operations
 */

const { githubClient } = require('../../integrations/github/client');
const { config } = require('../../core/config');

class TeamsService {
  constructor(cacheManager, repositoryService) {
    this.cacheManager = cacheManager;
    this.repositoryService = repositoryService;
    this.githubOrg = config.github.organization;
  }

  /**
   * Get all teams for organization
   */
  async getAllTeams(refresh = false) {
    const cacheKey = `org_teams_${this.githubOrg}`;
    
    if (!refresh) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        console.log(`💾 Tiimit löytyivät cachesta (${cached.length} tiimiä)`);
        return cached;
      }
    }

    console.log(`💾 Haetaan tiimit API:sta...`);
    
    try {
      const teams = await githubClient.getAllPages(`/orgs/${this.githubOrg}/teams`, {
        perPage: 100,
        maxPages: Infinity
      });

      // Cache for 1 hour
      await this.cacheManager.set(cacheKey, teams, 3600000);
      console.log(`💾 Tiimit tallennettu cacheen (${teams.length} tiimiä)`);

      return teams;
    } catch (error) {
      console.error('❌ Virhe tiimien haussa:', error.message);
      return [];
    }
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamSlug) {
    const cacheKey = `team_members_${this.githubOrg}_${teamSlug}`;
    
    let members = await this.cacheManager.get(cacheKey);
    
    if (!members) {
      try {
        members = await githubClient.getAllPages(`/orgs/${this.githubOrg}/teams/${teamSlug}/members`, {
          perPage: 100,
          maxPages: Infinity
        });

        // Cache for 24 hours
        await this.cacheManager.set(cacheKey, members, 86400000);
      } catch (error) {
        console.error(`❌ Virhe tiimin ${teamSlug} jäsenten haussa:`, error.message);
        return [];
      }
    }

    return members;
  }

  /**
   * Get team repositories
   */
  async getTeamRepositories(teamSlug) {
    const cacheKey = `team_repos_${this.githubOrg}_${teamSlug}`;
    
    let repos = await this.cacheManager.get(cacheKey);
    
    if (!repos) {
      try {
        repos = await githubClient.getAllPages(`/orgs/${this.githubOrg}/teams/${teamSlug}/repos`, {
          perPage: 100,
          maxPages: Infinity
        });

        // Cache for 1 hour
        await this.cacheManager.set(cacheKey, repos, 3600000);
      } catch (error) {
        console.error(`❌ Virhe tiimin ${teamSlug} repositoryjen haussa:`, error.message);
        return [];
      }
    }

    return repos;
  }

  /**
   * Get teams statistics
   */
  async getTeamsStatistics(teams, repositories) {
    const stats = {
      totalTeams: teams.length,
      teamsWithRepos: 0,
      teamsWithoutRepos: 0,
      totalMembers: 0,
      averageMembersPerTeam: 0,
      totalRepos: 0
    };

    // Calculate team repository counts
    const teamRepoCounts = {};
    const teamMemberCounts = {};

    // Process repositories to count per team
    repositories.forEach(repo => {
      const teams = Array.isArray(repo.all_teams) 
        ? repo.all_teams 
        : (repo.all_teams ? JSON.parse(repo.all_teams || '[]') : []);
      
      teams.forEach(teamName => {
        teamRepoCounts[teamName] = (teamRepoCounts[teamName] || 0) + 1;
      });
    });

    // Fetch member counts for each team (with batching)
    const batchSize = 5;
    for (let i = 0; i < teams.length; i += batchSize) {
      const batch = teams.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (team) => {
          try {
            const members = await this.getTeamMembers(team.slug);
            return { team: team.slug, memberCount: members.length };
          } catch (error) {
            return { team: team.slug, memberCount: 0 };
          }
        })
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { team, memberCount } = result.value;
          teamMemberCounts[team] = memberCount;
          stats.totalMembers += memberCount;
        }
      });

      // Small delay between batches
      if (i + batchSize < teams.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Calculate statistics
    teams.forEach(team => {
      const repoCount = teamRepoCounts[team.name] || teamRepoCounts[team.slug] || 0;
      if (repoCount > 0) {
        stats.teamsWithRepos++;
        stats.totalRepos += repoCount;
      } else {
        stats.teamsWithoutRepos++;
      }
    });

    stats.averageMembersPerTeam = stats.totalTeams > 0 
      ? Math.round(stats.totalMembers / stats.totalTeams) 
      : 0;

    // Enrich teams with statistics
    const enrichedTeams = teams.map(team => ({
      ...team,
      repoCount: teamRepoCounts[team.name] || teamRepoCounts[team.slug] || 0,
      memberCount: teamMemberCounts[team.slug] || 0,
      hasRepos: (teamRepoCounts[team.name] || teamRepoCounts[team.slug] || 0) > 0
    }));

    // Sort by repository count (descending)
    enrichedTeams.sort((a, b) => b.repoCount - a.repoCount);

    return {
      teams: enrichedTeams,
      stats
    };
  }
}

module.exports = TeamsService;

