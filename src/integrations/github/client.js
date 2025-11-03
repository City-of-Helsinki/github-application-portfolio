const { Octokit } = require('@octokit/rest');
const { throttling } = require('@octokit/plugin-throttling');
const crypto = require('crypto');
const { config } = require('../../core/config');
const { defaultCache } = require('../cache/memoryCache');
const { UpstreamError } = require('../../core/errors');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function cacheKeyFor(route, params) { return crypto.createHash('sha1').update(route + '|' + JSON.stringify(params || {})).digest('hex'); }

class GitHubClient {
  constructor(options = {}) {
    const ThrottledOctokit = Octokit.plugin(throttling);
    this.octokit = new ThrottledOctokit({
      auth: config.github.token || undefined,
      userAgent: config.github.userAgent,
      baseUrl: config.github.baseUrl,
      request: { timeout: config.github.timeoutMs },
      throttle: {
        onRateLimit: (retryAfter, options, octokit, retryCount) => {
          const waitMs = (retryAfter || 1) * 1000;
          console.warn(`GitHub primary rate limit hit for ${options.method} ${options.url}. Retry in ${waitMs}ms (attempt ${retryCount + 1}/${this.maxRetries}).`);
          if (retryCount < this.maxRetries) {
            return true; // plugin waits retryAfter then retries
          }
        },
        onSecondaryRateLimit: async (retryAfter, options, octokit, retryCount) => {
          // Apply exponential backoff with jitter beyond retryAfter
          const base = (retryAfter || 1) * 1000;
          const extra = Math.min(30000, Math.pow(2, retryCount || 0) * 500 + Math.random() * 1000);
          const waitMs = base + extra;
          console.warn(`GitHub secondary rate limit for ${options.method} ${options.url}. Backing off ${waitMs}ms (attempt ${retryCount || 0}).`);
          await sleep(waitMs);
          return true; // retry after custom backoff
        }
      }
    });
    this.maxRetries = options.maxRetries ?? config.github.maxRetries;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? config.github.retryBaseDelayMs;
    this.cache = options.cache || defaultCache;
  }

  async request(method, url, { params = {}, headers = {}, etagCacheTtlMs = 5 * 60 * 1000 } = {}) {
    // Translate path URL like "/orgs/{org}/repos" to Octokit route
    const route = `${method} ${url}`;
    const key = cacheKeyFor(route, params);
    const cached = this.cache.get(key);
    if (cached?.etag) headers['If-None-Match'] = cached.etag;

    let attempt = 0;
    while (true) {
      try {
        const res = await this.octokit.request(route, { ...params, headers });
        const etag = res.headers.etag;
        if (etag) this.cache.set(key, { etag, data: res.data, headers: res.headers }, etagCacheTtlMs);
        return { data: res.data, headers: res.headers, status: res.status };
      } catch (err) {
        // 304 Not Modified - serve cache
        if (err.status === 304 && cached?.data) {
          return { data: cached.data, headers: cached.headers, status: 200, fromCache: true };
        }
        // Handle secondary rate limit (403) with manual backoff if plugin didn't
        if (err.status === 403 && attempt < this.maxRetries) {
          const retryAfter = Number(err.response?.headers?.['retry-after']) || 1;
          const delay = Math.min(60000, retryAfter * 1000 + Math.pow(2, attempt) * 500 + Math.random() * 1000);
          attempt += 1;
          await sleep(delay);
          continue;
        }
        // Retry on 5xx
        if (err.status && err.status >= 500 && err.status < 600 && attempt < this.maxRetries) {
          const delay = this.retryBaseDelayMs * Math.pow(2, attempt);
          attempt += 1; await sleep(delay); continue;
        }
        throw new UpstreamError(`GitHub request failed (${err.status || 'ERR'})`, err.status || 502, { route, params });
      }
    }
  }

  async getAllPages(url, { params = {}, perPage = 100, maxPages = Infinity } = {}) {
    const route = `GET ${url}`;
    const results = [];
    let pageCounter = 0;
    for await (const response of this.octokit.paginate.iterator(route, { ...params, per_page: perPage })) {
      results.push(...response.data);
      pageCounter += 1;
      if (pageCounter >= maxPages) break;
    }
    return results;
  }

  async getOrgCodeScanningAlerts(org, { page = 1, perPage = 100, state, severity, toolName } = {}) {
    const params = { page, per_page: perPage };
    if (state) params.state = state; // open|closed
    if (severity) params.severity = severity; // critical|high|medium|low
    if (toolName) params.tool_name = toolName;
    try {
      const res = await this.request('GET', `/orgs/${org}/code-scanning/alerts`, { params });
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      throw e;
    }
  }

  async getRepoCodeScanningAlerts(owner, repo, { page = 1, perPage = 100, state, severity, toolName } = {}) {
    const params = { page, per_page: perPage };
    if (state) params.state = state;
    if (severity) params.severity = severity;
    if (toolName) params.tool_name = toolName;
    const res = await this.request('GET', `/repos/${owner}/${repo}/code-scanning/alerts`, { params });
    return Array.isArray(res.data) ? res.data : [];
  }
}

const githubClient = new GitHubClient();
module.exports = { GitHubClient, githubClient };


