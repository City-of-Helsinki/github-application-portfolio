#!/usr/bin/env node
/**
 * Test script to explore GitHub API
 * Usage: node test-github-api.js <owner> <repo>
 * Example: node test-github-api.js City-of-Helsinki github-application-portfolio
 */

const axios = require('axios');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const owner = process.argv[2] || 'City-of-Helsinki';
const repo = process.argv[3] || 'github-application-portfolio';

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN not set in .env file');
  process.exit(1);
}

const GITHUB_API_BASE = 'https://api.github.com';

// Helper to make API requests
async function getAPI(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`❌ API Error (${error.response.status}):`, error.response.statusText);
      if (error.response.data) {
        console.error('   Response:', JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.error('❌ Error:', error.message);
    }
    return null;
  }
}

// Main function to explore repository data
async function exploreRepository() {
  console.log(`\n🔍 Exploring repository: ${owner}/${repo}\n`);
  console.log('═'.repeat(60));
  
  // 1. Repository basic info
  console.log('\n📊 1. Repository Info:');
  const repoUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
  console.log(`   🔗 URL: ${repoUrl}`);
  const repoData = await getAPI(repoUrl);
  if (repoData) {
    console.log(`   Name: ${repoData.name}`);
    console.log(`   Full Name: ${repoData.full_name}`);
    console.log(`   Description: ${repoData.description || 'None'}`);
    console.log(`   Language: ${repoData.language || 'None'}`);
    console.log(`   Stars: ${repoData.stargazers_count}`);
    console.log(`   Forks: ${repoData.forks_count}`);
    console.log(`   Private: ${repoData.private}`);
    console.log(`   Archived: ${repoData.archived}`);
    console.log(`   Topics: ${repoData.topics?.join(', ') || 'None'}`);
    console.log(`   Created: ${repoData.created_at}`);
    console.log(`   Updated: ${repoData.updated_at}`);
    console.log(`   Pushed: ${repoData.pushed_at}`);
    console.log(`   Default Branch: ${repoData.default_branch}`);
    console.log(`   License: ${repoData.license?.name || 'None'}`);
    console.log(`   Owner: ${repoData.owner?.login} (${repoData.owner?.type})`);
  }
  
  // 2. Languages breakdown
  console.log('\n🌍 2. Languages Breakdown:');
  const languagesUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/languages`;
  console.log(`   🔗 URL: ${languagesUrl}`);
  const languages = await getAPI(languagesUrl);
  if (languages) {
    const total = Object.values(languages).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(languages).sort(([,a], [,b]) => b - a);
    sorted.forEach(([lang, bytes]) => {
      const percentage = ((bytes / total) * 100).toFixed(1);
      console.log(`   ${lang}: ${bytes.toLocaleString()} bytes (${percentage}%)`);
    });
  }
  
  // 3. Latest commit info
  console.log('\n📝 3. Latest Commit:');
  const commitsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?per_page=1`;
  console.log(`   🔗 URL: ${commitsUrl}`);
  const commits = await getAPI(commitsUrl);
  if (commits && commits.length > 0) {
    const commit = commits[0];
    console.log(`   SHA: ${commit.sha}`);
    console.log(`   Message: ${commit.commit.message.split('\n')[0]}`);
    console.log(`   Author: ${commit.commit.author.name} <${commit.commit.author.email}>`);
    console.log(`   Date: ${commit.commit.author.date}`);
    if (commit.author) {
      console.log(`   Author GitHub: ${commit.author.login}`);
    }
  }
  
  // 4. Teams with access
  console.log('\n👥 4. Teams:');
  const teamsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/teams`;
  console.log(`   🔗 URL: ${teamsUrl}`);
  const teams = await getAPI(teamsUrl);
  if (teams && teams.length > 0) {
    teams.forEach(team => {
      console.log(`   - ${team.name} (${team.slug}) - Permission: ${team.permission}`);
    });
  } else {
    console.log('   No teams found or no access');
  }
  
  // 5. Collaborators
  console.log('\n🤝 5. Collaborators:');
  const collaboratorsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/collaborators`;
  console.log(`   🔗 URL: ${collaboratorsUrl}`);
  const collaborators = await getAPI(collaboratorsUrl);
  if (collaborators) {
    collaborators.forEach(collab => {
      console.log(`   - ${collab.login} (${collab.permissions?.admin ? 'admin' : collab.permissions?.push ? 'push' : 'pull'})`);
    });
  }
  
  // 6. Branch info
  console.log('\n🌿 6. Branches:');
  const branchesUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/branches`;
  console.log(`   🔗 URL: ${branchesUrl}`);
  const branches = await getAPI(branchesUrl);
  if (branches) {
    branches.slice(0, 5).forEach(branch => {
      console.log(`   - ${branch.name} (${branch.protected ? 'protected' : 'normal'})`);
    });
    if (branches.length > 5) {
      console.log(`   ... and ${branches.length - 5} more`);
    }
  }
  
  // 7. Contents (files)
  console.log('\n📁 7. Top-level Files:');
  const contentsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents`;
  console.log(`   🔗 URL: ${contentsUrl}`);
  const contents = await getAPI(contentsUrl);
  if (contents && Array.isArray(contents)) {
    contents.forEach(item => {
      const icon = item.type === 'dir' ? '📁' : '📄';
      const size = item.size ? ` (${item.size} bytes)` : '';
      console.log(`   ${icon} ${item.name}${size}`);
    });
  }
  
  // 8. Releases
  console.log('\n🏷️ 8. Recent Releases:');
  const releasesUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases?per_page=3`;
  console.log(`   🔗 URL: ${releasesUrl}`);
  const releases = await getAPI(releasesUrl);
  if (releases && releases.length > 0) {
    releases.forEach(release => {
      console.log(`   - ${release.tag_name} (${release.name || 'Untitled'})`);
    });
  } else {
    console.log('   No releases found');
  }
  
  // 9. Dependabot alerts (if accessible)
  console.log('\n🔒 9. Dependabot Alerts:');
  try {
    const alertsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/dependabot/alerts`;
    console.log(`   🔗 URL: ${alertsUrl}`);
    const alerts = await getAPI(alertsUrl);
    if (alerts && alerts.length > 0) {
      console.log(`   Total alerts: ${alerts.length}`);
      const bySeverity = {};
      alerts.forEach(alert => {
        bySeverity[alert.security_advisory.severity] = (bySeverity[alert.security_advisory.severity] || 0) + 1;
      });
      Object.entries(bySeverity).forEach(([severity, count]) => {
        console.log(`   - ${severity}: ${count}`);
      });
    } else {
      console.log('   No alerts or no access (may require security permissions)');
    }
  } catch (error) {
    console.log('   Access denied or not available');
  }
  
  // 10. Pull requests
  console.log('\n🔀 10. Recent Pull Requests:');
  const prsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=all&per_page=3&sort=updated`;
  console.log(`   🔗 URL: ${prsUrl}`);
  const prs = await getAPI(prsUrl);
  if (prs && prs.length > 0) {
    prs.forEach(pr => {
      console.log(`   - #${pr.number}: ${pr.title} (${pr.state}) by ${pr.user.login}`);
    });
  } else {
    console.log('   No pull requests found');
  }
  
  // 11. Issues
  console.log('\n🐛 11. Recent Issues:');
  const issuesUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?state=all&per_page=3`;
  console.log(`   🔗 URL: ${issuesUrl}`);
  const issues = await getAPI(issuesUrl);
  if (issues && issues.length > 0) {
    issues.forEach(issue => {
      console.log(`   - #${issue.number}: ${issue.title} (${issue.state}) by ${issue.user.login}`);
    });
  } else {
    console.log('   No issues found');
  }
  
  // 12. Contributors
  console.log('\n👤 12. Top Contributors:');
  const contributorsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contributors`;
  console.log(`   🔗 URL: ${contributorsUrl}`);
  const contributors = await getAPI(contributorsUrl);
  if (contributors) {
    contributors.slice(0, 5).forEach(contrib => {
      console.log(`   - ${contrib.login} (${contrib.contributions} contributions)`);
    });
  }
  
  // 13. Custom properties (if available)
  console.log('\n🔧 13. Custom Properties:');
  try {
    const propsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/properties/values`;
    console.log(`   🔗 URL: ${propsUrl}`);
    const props = await getAPI(propsUrl);
    if (props && Object.keys(props).length > 0) {
      console.log(JSON.stringify(props, null, 2));
    } else {
      console.log('   No custom properties');
    }
  } catch (error) {
    console.log('   Custom properties not available');
  }
  
  // 14. Code scanning alerts (if accessible)
  console.log('\n🔎 14. Code Scanning Alerts:');
  try {
    const scanAlertsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/code-scanning/alerts?state=open`;
    console.log(`   🔗 URL: ${scanAlertsUrl}`);
    const scanAlerts = await getAPI(scanAlertsUrl);
    if (scanAlerts && scanAlerts.length > 0) {
      console.log(`   Open alerts: ${scanAlerts.length}`);
      scanAlerts.slice(0, 3).forEach(alert => {
        console.log(`   - ${alert.rule.id}: ${alert.state}`);
      });
    } else {
      console.log('   No scanning alerts or no access');
    }
  } catch (error) {
    console.log('   Code scanning not available or no access');
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log(`\n✅ Repository exploration complete!\n`);
}

// Run the exploration
exploreRepository().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
