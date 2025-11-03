/**
 * Service layer for commits business logic
 * Handles all commit-related operations
 */

const { githubClient } = require('../../integrations/github/client');
const { config } = require('../../core/config');

class CommitsService {
  constructor(cacheManager) {
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
   * Get latest commit data for a repository
   */
  async getLatestCommitData(ownerLogin, repoName) {
    try {
      const cacheKey = `latest_commit_data_${ownerLogin}_${repoName}`;
      let cachedData = await this.cacheManager.get(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }

      const { data } = await githubClient.request('GET', `/repos/${ownerLogin}/${repoName}/commits`, {
        params: {
          per_page: 1,
          page: 1
        }
      });

      let commitData = {
        author: null,
        message: null,
        date: null,
        sha: null,
        url: null
      };

      if (data && data.length > 0) {
        const lastCommit = data[0];

        commitData.sha = lastCommit.sha;
        commitData.url = lastCommit.html_url;

        // Get author (username or name)
        if (lastCommit.author && lastCommit.author.login) {
          commitData.author = lastCommit.author.login;
          commitData.authorUrl = lastCommit.author.html_url;
          commitData.authorAvatar = lastCommit.author.avatar_url;
        } else if (lastCommit.commit && lastCommit.commit.author) {
          commitData.author = lastCommit.commit.author.name;
        }

        // Get commit message
        if (lastCommit.commit && lastCommit.commit.message) {
          commitData.message = lastCommit.commit.message.split('\n')[0]; // First line
          commitData.fullMessage = lastCommit.commit.message;
        }

        // Get date
        if (lastCommit.commit && lastCommit.commit.author) {
          commitData.date = lastCommit.commit.author.date;
        }
      }

      // Cache the result for 24 hours
      await this.cacheManager.set(cacheKey, commitData, 24 * 60 * 60 * 1000);

      return commitData;
    } catch (error) {
      console.log(`⚠️ Could not fetch last commit for ${repoName}: ${error.message}`);
      return { author: null, message: null, date: null, sha: null, url: null };
    }
  }

  /**
   * Get commit statistics for repositories
   */
  async getCommitStatistics(repositories) {
    const stats = {
      totalCommits: 0,
      reposWithCommits: 0,
      reposWithoutCommits: 0,
      topCommitters: {},
      recentCommits: []
    };

    const reposWithCommits = [];
    const batchSize = 5;

    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          const ownerLogin = this.getOwnerLogin(repo);
          const commitData = await this.getLatestCommitData(ownerLogin, repo.name);
          
          return {
            ...repo,
            latest_commit: commitData
          };
        })
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          reposWithCommits.push(result.value);
          
          if (result.value.latest_commit && result.value.latest_commit.author) {
            stats.reposWithCommits++;
            const author = result.value.latest_commit.author;
            stats.topCommitters[author] = (stats.topCommitters[author] || 0) + 1;
            
            stats.recentCommits.push({
              repo: result.value.name,
              repoUrl: result.value.html_url,
              author: author,
              authorUrl: result.value.latest_commit.authorUrl,
              authorAvatar: result.value.latest_commit.authorAvatar,
              message: result.value.latest_commit.message,
              date: result.value.latest_commit.date,
              sha: result.value.latest_commit.sha,
              url: result.value.latest_commit.url
            });
          } else {
            stats.reposWithoutCommits++;
          }
        }
      });

      // Small delay between batches
      if (i + batchSize < repositories.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Sort commits by date (most recent first)
    stats.recentCommits.sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB - dateA;
    });

    // Sort committers by count
    stats.topCommitters = Object.entries(stats.topCommitters)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([author, count]) => ({ author, count }));

    // Sort repositories by commit date
    reposWithCommits.sort((a, b) => {
      const dateA = a.latest_commit?.date ? new Date(a.latest_commit.date) : new Date(0);
      const dateB = b.latest_commit?.date ? new Date(b.latest_commit.date) : new Date(0);
      return dateB - dateA;
    });

    return {
      repositories: reposWithCommits,
      stats
    };
  }
}

module.exports = CommitsService;

