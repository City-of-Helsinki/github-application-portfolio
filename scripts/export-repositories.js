#!/usr/bin/env node
/*
Fetch all non-archived repositories for an organization and write them to a YAML file.

Usage:
  GITHUB_TOKEN=... GITHUB_ORG=City-of-Helsinki node scripts/export-repositories.js [outputFile]

Defaults:
  outputFile: repositories.yml
*/

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const { throttling } = require('@octokit/plugin-throttling');

const ThrottledOctokit = Octokit.plugin(throttling);

const org = process.env.GITHUB_ORG || 'City-of-Helsinki';
const token = process.env.GITHUB_TOKEN || '';
const output = process.argv[2] || 'repositories.yml';

if (!token) {
  console.error('Missing GITHUB_TOKEN environment variable.');
  process.exit(1);
}

const octokit = new ThrottledOctokit({
  auth: token,
  userAgent: 'Repo-Exporter',
  throttle: {
    onRateLimit: (retryAfter, options, _octokit, retryCount) => {
      if (retryCount < 3) return true;
    },
    onSecondaryRateLimit: async (retryAfter, options) => {
      await new Promise(r => setTimeout(r, (retryAfter || 1) * 1000));
      return true;
    }
  }
});

async function main() {
  const repos = [];
  const iterator = octokit.paginate.iterator('GET /orgs/{org}/repos', {
    org,
    type: 'all',
    per_page: 100
  });

  for await (const { data } of iterator) {
    for (const r of data) {
      if (r && !r.archived) {
        repos.push(r.full_name);
      }
    }
  }

  repos.sort((a, b) => a.localeCompare(b));

  const lines = ['repositories:'];
  for (const name of repos) {
    lines.push(`  - "${name}"`);
  }

  const content = lines.join('\n') + '\n';
  const outPath = path.resolve(process.cwd(), output);
  fs.writeFileSync(outPath, content, 'utf8');

  console.log(`Wrote ${repos.length} repositories to ${outPath}`);
}

main().catch(err => {
  console.error('Export failed:', err.message);
  process.exit(1);
});


