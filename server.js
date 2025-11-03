const express = require('express');
const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();
const { requestIdMiddleware, requestLoggerMiddleware } = require('./src/core/logging');
const { errorHandler } = require('./src/core/errors');
const { config } = require('./src/core/config');
const { githubClient } = require('./src/integrations/github/client');
const { navigationItems, settingsItem } = require('./src/core/navigation');
const { initializeDependencies } = require('./src/app/dependencies');
const { getLanguageColor } = require('./src/core/utils/languageColors');

// Kieltien värit
const languageColors = {
  'JavaScript': '#f1e05a',
  'TypeScript': '#2b7489',
  'Python': '#3572A5',
  'Java': '#b07219',
  'C++': '#f34b7d',
  'C#': '#239120',
  'Go': '#00ADD8',
  'Rust': '#dea584',
  'PHP': '#4F5D95',
  'Ruby': '#701516',
  'Swift': '#ffac45',
  'Kotlin': '#A97BFF',
  'Dart': '#00B4AB',
  'HTML': '#e34c26',
  'CSS': '#1572B6',
  'Vue': '#4FC08D',
  'React': '#61DAFB',
  'Angular': '#DD0031',
  'Node.js': '#339933',
  'Shell': '#89e051',
  'Dockerfile': '#384d54',
  'YAML': '#cb171e',
  'JSON': '#000000',
  'Markdown': '#083fa1',
  'SQL': '#336791',
  'R': '#198CE7',
  'Scala': '#c22d40',
  'Clojure': '#db5855',
  'Haskell': '#5e5086',
  'Elixir': '#6e4a7e',
  'Erlang': '#a90533',
  'Lua': '#000080',
  'Perl': '#0298c3',
  'PowerShell': '#012456',
  'Assembly': '#6E4C13',
  'C': '#555555',
  'Objective-C': '#438eff',
  'Roff': '#ecdebe',
  'TeX': '#3D6117',
  'Vim script': '#199f4b',
  'Emacs Lisp': '#c065db',
  'Makefile': '#427819',
  'CMake': '#064F8C',
  'Batchfile': '#C1F12E',
  'Dockerfile': '#384d54',
  'INI': '#d1dbe0',
  'TOML': '#9c4221',
  'XML': '#005f9f',
  'SVG': '#ff9900',
  'GraphQL': '#e10098',
  'Solidity': '#AA6746',
  'WebAssembly': '#654FF0',
  'Svelte': '#ff3e00',
  'Next.js': '#000000',
  'Nuxt.js': '#00DC82',
  'Gatsby': '#663399',
  'Jest': '#C21325',
  'Mocha': '#8d6748',
  'Chai': '#A30701',
  'Cypress': '#17202C',
  'Playwright': '#2EAD33',
  'Puppeteer': '#40B5A4',
  'Webpack': '#8DD6F9',
  'Babel': '#F9DC3E',
  'ESLint': '#4B32C3',
  'Prettier': '#F7B93E',
  'Jest': '#C21325',
  'Mocha': '#8d6748',
  'Chai': '#A30701',
  'Cypress': '#17202C',
  'Playwright': '#2EAD33',
  'Puppeteer': '#40B5A4',
  'Webpack': '#8DD6F9',
  'Babel': '#F9DC3E',
  'ESLint': '#4B32C3',
  'Prettier': '#F7B93E'
};

// getLanguageColor is already imported from src/core/utils/languageColors
// No need to redefine it here

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Core middlewares
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Add navigation config to all views
app.use((req, res, next) => {
  res.locals.navigationItems = navigationItems;
  res.locals.settingsItem = settingsItem;
  res.locals.currentPath = req.path;
  next();
});

// Dependencies will be initialized later (after DatabaseCacheManager class definition)
// See line ~904 for initialization

// Add language color helper to app locals
app.locals.getLanguageColor = getLanguageColor;

// GitHub API konfiguraatio
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ORG = process.env.GITHUB_ORG || 'City-of-Helsinki';

// Rate limiting configuration
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';
const RATE_LIMIT_DEBUG = process.env.RATE_LIMIT_DEBUG === 'true';

// Test configuration - limit number of repositories
const MAX_REPOSITORIES = process.env.MAX_REPOSITORIES ? parseInt(process.env.MAX_REPOSITORIES) : null;

// Database configuration
const USE_DATABASE = process.env.USE_DATABASE !== 'false';

// GitHub API headers
const githubHeaders = {
  'Authorization': `token ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'Application-Portfolio'
};

// Debug GitHub API access
console.log('🔑 GitHub API konfiguraatio:');
console.log(`   - Token: ${GITHUB_TOKEN ? 'Asetettu' : 'PUUTTUU'}`);
console.log(`   - Max Repositories: ${MAX_REPOSITORIES ? MAX_REPOSITORIES : 'Ei rajaa'}`);
console.log(`   - Organisaatio: ${GITHUB_ORG}`);
console.log(`   - Database: ${USE_DATABASE ? 'Käytössä' : 'POIS PÄÄLTÄ (käyttää in-memory cachea)'}`);
console.log(`   - Rate limiting: ${RATE_LIMIT_ENABLED ? 'PÄÄLLÄ' : 'POIS PÄÄLTÄ'}`);
console.log(`   - Debug mode: ${RATE_LIMIT_DEBUG ? 'PÄÄLLÄ' : 'POIS PÄÄLTÄ'}`);

// Rate limiting utilities
class RateLimiter {
  constructor() {
    this.requestQueue = [];
    this.isProcessing = false;
    this.rateLimitInfo = {
      limit: 5000,
      remaining: 5000,
      reset: Date.now() + 3600000, // 1 hour from now
      used: 0
    };
    this.concurrentRequests = 0;
    this.maxConcurrent = 30; // Reduced from 50 to 30
    this.requestsPerMinute = 0;
    this.lastMinuteReset = Date.now();
    this.enabled = RATE_LIMIT_ENABLED;
    this.debug = RATE_LIMIT_DEBUG;
  }

  async makeRequest(url, options = {}) {
    // If rate limiting is disabled, make direct request
    if (!this.enabled) {
      if (this.debug) {
        console.log(`🚀 Rate limit disabled - direct request to: ${url}`);
      }
      return this.executeDirectRequest(url, options);
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, options, resolve, reject });
      this.processQueue();
    });
  }

  // Direct request without rate limiting
  async executeDirectRequest(url, options = {}, retryCount = 0) {
    const maxRetries = 3;
    
    try {
      const response = await axios.get(url, {
        ...options,
        headers: { ...githubHeaders, ...options.headers },
        timeout: 30000 // 30 second timeout
      });

      // Update rate limit info from response headers (for monitoring)
      if (response.headers['x-ratelimit-limit']) {
        this.rateLimitInfo.limit = parseInt(response.headers['x-ratelimit-limit']);
        this.rateLimitInfo.remaining = parseInt(response.headers['x-ratelimit-remaining']);
        this.rateLimitInfo.reset = parseInt(response.headers['x-ratelimit-reset']) * 1000;
        this.rateLimitInfo.used = parseInt(response.headers['x-ratelimit-used']);
      }

      return response;
    } catch (error) {
      if (this.debug) {
        console.log(`❌ Direct request failed: ${url} - ${error.message} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      }
      
      // Retry on 502, 503, 504 errors
      if ((error.response?.status >= 500 && error.response?.status <= 504) && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`🔄 Retrying request after ${delay}ms due to server error ${error.response.status}`);
        await this.delay(delay);
        return this.executeDirectRequest(url, options, retryCount + 1);
      }
      
      throw error;
    }
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0 && this.concurrentRequests < this.maxConcurrent) {
      const { url, options, resolve, reject } = this.requestQueue.shift();
      
      // Check rate limits
      if (this.rateLimitInfo.remaining <= 10) {
        const waitTime = (this.rateLimitInfo.reset - Date.now()) / 1000;
        console.log(`⏳ Rate limit lähellä, odotetaan ${Math.ceil(waitTime)} sekuntia...`);
        await this.delay(waitTime * 1000);
      }

      // Check secondary rate limits - reduced from 80 to 60
      if (this.requestsPerMinute >= 60) {
        const waitTime = 60000 - (Date.now() - this.lastMinuteReset);
        if (waitTime > 0) {
          console.log(`⏳ Secondary rate limit, odotetaan ${Math.ceil(waitTime / 1000)} sekuntia...`);
          await this.delay(waitTime);
        }
      }

      this.executeRequest(url, options, resolve, reject);
    }
    
    this.isProcessing = false;
  }

  async executeRequest(url, options, resolve, reject, retryCount = 0) {
    this.concurrentRequests++;
    this.requestsPerMinute++;

    // Reset minute counter if needed
    if (Date.now() - this.lastMinuteReset >= 60000) {
      this.requestsPerMinute = 0;
      this.lastMinuteReset = Date.now();
    }

    try {
      const response = await axios.get(url, {
        ...options,
        headers: { ...githubHeaders, ...options.headers }
      });

      // Update rate limit info from response headers
      if (response.headers['x-ratelimit-limit']) {
        this.rateLimitInfo.limit = parseInt(response.headers['x-ratelimit-limit']);
        this.rateLimitInfo.remaining = parseInt(response.headers['x-ratelimit-remaining']);
        this.rateLimitInfo.reset = parseInt(response.headers['x-ratelimit-reset']) * 1000;
        this.rateLimitInfo.used = parseInt(response.headers['x-ratelimit-used']);
      }

      resolve(response);
    } catch (error) {
      if (error.response?.status === 403 || error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const resetTime = error.response.headers['x-ratelimit-reset'];
        
        // Smart retry with exponential backoff
        const maxRetries = 3;
        if (retryCount < maxRetries) {
          const baseDelay = retryAfter ? parseInt(retryAfter) * 1000 : 1000;
          const exponentialDelay = baseDelay * Math.pow(2, retryCount);
          const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
          const delay = Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
          
          console.log(`⏳ Rate limited, retry ${retryCount + 1}/${maxRetries}, odotetaan ${Math.ceil(delay / 1000)} sekuntia...`);
          await this.delay(delay);
          
          // Retry with increased retry count
          this.requestQueue.unshift({ url, options, resolve, reject, retryCount: retryCount + 1 });
        } else {
          console.log(`❌ Max retries exceeded for ${url}`);
          reject(error);
        }
      } else if (error.response?.status >= 500 && retryCount < 2) {
        // Retry on server errors
        const delay = 1000 * Math.pow(2, retryCount);
        console.log(`🔄 Server error, retry ${retryCount + 1}/2, odotetaan ${delay}ms...`);
        await this.delay(delay);
        this.requestQueue.unshift({ url, options, resolve, reject, retryCount: retryCount + 1 });
      } else {
        reject(error);
      }
    } finally {
      this.concurrentRequests--;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getRateLimitStatus() {
    return {
      ...this.rateLimitInfo,
      concurrentRequests: this.concurrentRequests,
      requestsPerMinute: this.requestsPerMinute,
      queueLength: this.requestQueue.length
    };
  }
}

const rateLimiter = new RateLimiter();

// Database setup
let db = null;
if (USE_DATABASE) {
  db = new sqlite3.Database('./portfolio.db');
  console.log('💾 Tietokanta käytössä');
} else {
  console.log('💾 Tietokanta pois käytöstä - käytetään in-memory cachea');
}

// Initialize database tables (only if database is enabled)
if (db) {
  db.serialize(() => {
  // Cache table for API responses
  db.run(`CREATE TABLE IF NOT EXISTS cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  )`);
  
  // Repository data table
  db.run(`CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    description TEXT,
    html_url TEXT,
    clone_url TEXT,
    homepage TEXT,
    language TEXT,
    languages TEXT,
    stargazers_count INTEGER,
    forks_count INTEGER,
    updated_at DATETIME,
    created_at DATETIME,
    topics TEXT,
    readme TEXT,
    docker_base_image TEXT,
    django_version TEXT,
    react_version TEXT,
    drupal_version TEXT,
    dependabot_critical_count INTEGER,
    owner TEXT,
    team TEXT,
    all_teams TEXT,
    dependabot_access TEXT,
    dependabot_permissions TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Create indexes for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_cache_key ON cache(key)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_repos_name ON repositories(name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_repos_updated ON repositories(updated_at)`);
  
    // Migration: Add owner, team and dependabot_access columns if they don't exist
    db.all(`PRAGMA table_info(repositories)`, (err, columns) => {
      if (err) {
        console.error('Error checking table columns:', err);
        return;
      }
      
      const columnNames = columns.map(col => col.name);
      
      if (!columnNames.includes('owner')) {
        db.run(`ALTER TABLE repositories ADD COLUMN owner TEXT`, (alterErr) => {
          if (alterErr) {
            console.error('Error adding owner column:', alterErr);
          } else {
            console.log('✅ Added owner column to repositories table');
          }
        });
      }
      
      if (!columnNames.includes('team')) {
        db.run(`ALTER TABLE repositories ADD COLUMN team TEXT`, (alterErr) => {
          if (alterErr) {
            console.error('Error adding team column:', alterErr);
          } else {
            console.log('✅ Added team column to repositories table');
          }
        });
      }
      
      if (!columnNames.includes('dependabot_access')) {
        db.run(`ALTER TABLE repositories ADD COLUMN dependabot_access TEXT`, (alterErr) => {
          if (alterErr) {
            console.error('Error adding dependabot_access column:', alterErr);
          } else {
            console.log('✅ Added dependabot_access column to repositories table');
          }
        });
      }
      
      if (!columnNames.includes('all_teams')) {
        db.run(`ALTER TABLE repositories ADD COLUMN all_teams TEXT`, (alterErr) => {
          if (alterErr) {
            console.error('Error adding all_teams column:', alterErr);
          } else {
            console.log('✅ Added all_teams column to repositories table');
          }
        });
      }
      
      if (!columnNames.includes('dependabot_permissions')) {
        db.run(`ALTER TABLE repositories ADD COLUMN dependabot_permissions TEXT`, (alterErr) => {
          if (alterErr) {
            console.error('Error adding dependabot_permissions column:', alterErr);
          } else {
            console.log('✅ Added dependabot_permissions column to repositories table');
          }
        });
      }
    });
  });
}

// Database-based cache system (or in-memory if database is disabled)
class DatabaseCacheManager {
  constructor() {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      totalRequests: 0
    };
    this.pendingRequests = new Map(); // For request deduplication
    
    // In-memory cache when database is disabled
    this.memoryCache = new Map();
    this.memoryRepositories = new Map(); // In-memory repository storage
    this.useDatabase = USE_DATABASE;
  }

  // Generate cache key for repository data
  getCacheKey(repoName, dataType) {
    return `${repoName}:${dataType}`;
  }

  // Get data from database cache or in-memory cache
  get(key) {
    return new Promise((resolve) => {
      this.cacheStats.totalRequests++;
      
      if (!this.useDatabase) {
        // Use in-memory cache
        const cached = this.memoryCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          this.cacheStats.hits++;
          resolve(cached.data);
        } else {
          if (cached) {
            // Remove expired entry
            this.memoryCache.delete(key);
          }
          this.cacheStats.misses++;
          resolve(null);
        }
        return;
      }
      
      // Use database cache
      if (!db) {
        this.cacheStats.misses++;
        resolve(null);
        return;
      }
      
      db.get(
        'SELECT data, expires_at FROM cache WHERE key = ? AND expires_at > datetime("now")',
        [key],
        (err, row) => {
          if (err) {
            console.error('Database error:', err);
            this.cacheStats.misses++;
            resolve(null);
            return;
          }
          
          if (row) {
            this.cacheStats.hits++;
            try {
              const data = JSON.parse(row.data);
              resolve(data);
            } catch (parseError) {
              console.error('JSON parse error:', parseError);
              this.cacheStats.misses++;
              resolve(null);
            }
          } else {
            this.cacheStats.misses++;
            resolve(null);
          }
        }
      );
    });
  }

  // Set data in database cache or in-memory cache
  set(key, data, ttl = 3600000) { // Default 1 hour
    return new Promise((resolve) => {
      this.cacheStats.sets++;
      const expiresAt = Date.now() + ttl;
      
      if (!this.useDatabase) {
        // Use in-memory cache
        this.memoryCache.set(key, {
          data: data,
          expiresAt: expiresAt
        });
        resolve();
        return;
      }
      
      // Use database cache
      if (!db) {
        resolve();
        return;
      }
      
      const expiresAtISO = new Date(expiresAt).toISOString();
      const dataString = JSON.stringify(data);
      
      db.run(
        'INSERT OR REPLACE INTO cache (key, data, expires_at) VALUES (?, ?, ?)',
        [key, dataString, expiresAtISO],
        (err) => {
          if (err) {
            console.error('Database error:', err);
          }
          resolve();
        }
      );
    });
  }

  // Clear cache for specific repository
  clearRepo(repoName) {
    return new Promise((resolve) => {
      if (!this.useDatabase) {
        // Clear from in-memory cache
        const prefix = `${repoName}:`;
        for (const key of this.memoryCache.keys()) {
          if (key.startsWith(prefix)) {
            this.memoryCache.delete(key);
          }
        }
        resolve();
        return;
      }
      
      if (!db) {
        resolve();
        return;
      }
      
      db.run(
        'DELETE FROM cache WHERE key LIKE ?',
        [`${repoName}:%`],
        (err) => {
          if (err) {
            console.error('Database error:', err);
          }
          resolve();
        }
      );
    });
  }

  // Clear all cache
  clearAll() {
    return new Promise((resolve) => {
      if (!this.useDatabase) {
        // Clear in-memory cache
        this.memoryCache.clear();
        resolve();
        return;
      }
      
      if (!db) {
        resolve();
        return;
      }
      
      db.run('DELETE FROM cache', (err) => {
        if (err) {
          console.error('Database error:', err);
        }
        resolve();
      });
    });
  }

  // Get cache statistics
  getStats() {
    return new Promise((resolve) => {
      if (!this.useDatabase) {
        // Return in-memory cache stats
        const hitRate = this.cacheStats.totalRequests > 0 
          ? ((this.cacheStats.hits / this.cacheStats.totalRequests) * 100).toFixed(2) + '%'
          : '0%';
        
        resolve({
          ...this.cacheStats,
          hitRate,
          size: this.memoryCache.size,
          memoryUsage: process.memoryUsage().heapUsed
        });
        return;
      }
      
      if (!db) {
        resolve({
          ...this.cacheStats,
          hitRate: '0%',
          size: 0,
          memoryUsage: process.memoryUsage().heapUsed
        });
        return;
      }
      
      db.get('SELECT COUNT(*) as count FROM cache', (err, row) => {
        if (err) {
          console.error('Database error:', err);
          resolve({
            ...this.cacheStats,
            hitRate: '0%',
            size: 0,
            memoryUsage: process.memoryUsage().heapUsed
          });
          return;
        }
        
        const hitRate = this.cacheStats.totalRequests > 0 
          ? ((this.cacheStats.hits / this.cacheStats.totalRequests) * 100).toFixed(2) + '%'
          : '0%';
        
        resolve({
          ...this.cacheStats,
          hitRate,
          size: row.count,
          memoryUsage: process.memoryUsage().heapUsed
        });
      });
    });
  }

  // Clean expired entries
  cleanExpired() {
    return new Promise((resolve) => {
      if (!this.useDatabase) {
        // Clean expired entries from in-memory cache
        const now = Date.now();
        let cleaned = 0;
        for (const [key, value] of this.memoryCache.entries()) {
          if (value.expiresAt <= now) {
            this.memoryCache.delete(key);
            cleaned++;
          }
        }
        if (cleaned > 0) {
          console.log(`🧹 Cleaned ${cleaned} expired cache entries from memory`);
        }
        resolve();
        return;
      }
      
      if (!db) {
        resolve();
        return;
      }
      
      db.run(
        'DELETE FROM cache WHERE expires_at <= datetime("now")',
        (err) => {
          if (err) {
            console.error('Database error:', err);
          } else {
            console.log('🧹 Cleaned expired cache entries from database');
          }
          resolve();
        }
      );
    });
  }

  // Request deduplication - prevent multiple identical requests
  async deduplicateRequest(requestKey, requestFn) {
    if (this.pendingRequests.has(requestKey)) {
      console.log(`🔄 Deduplicating request: ${requestKey}`);
      return this.pendingRequests.get(requestKey);
    }

    const promise = requestFn();
    this.pendingRequests.set(requestKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  // Save repository data to database or in-memory storage
  saveRepository(repo) {
    return new Promise((resolve) => {
      // Extract team data from repo if available
      let owner = null;
      let team = null;
      let all_teams = [];
      
      if (repo.owner) {
        owner = typeof repo.owner === 'string' ? repo.owner : repo.owner;
      }
      
      if (repo.all_teams && Array.isArray(repo.all_teams) && repo.all_teams.length > 0) {
        all_teams = repo.all_teams;
        team = all_teams[0]; // Use first team as primary
      } else if (repo.team) {
        team = typeof repo.team === 'string' ? repo.team : repo.team;
        all_teams = [team];
      }
      
      const repoData = {
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        homepage: repo.homepage,
        language: repo.language,
        languages: JSON.stringify(repo.languages || {}),
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        updated_at: repo.updated_at,
        created_at: repo.created_at,
        topics: JSON.stringify(repo.topics || []),
        readme: repo.readme,
        docker_base_image: repo.docker_base_image || null,
        django_version: repo.django_version,
        react_version: repo.react_version,
        drupal_version: repo.drupal_version,
        wordpress_version: repo.wordpress_version || null,
        dependabot_critical_count: repo.dependabot_critical_count,
        owner: owner,
        team: team,
        all_teams: JSON.stringify(all_teams),
        dependabot_access: null,
        dependabot_permissions: JSON.stringify(repo.dependabot_permissions || [])
      };

      if (!this.useDatabase) {
        // Save to in-memory storage
        this.memoryRepositories.set(repo.name, {
          ...repoData,
          languages: repo.languages || {},
          topics: repo.topics || [],
          all_teams: all_teams,
          dependabot_permissions: repo.dependabot_permissions || []
        });
        resolve();
        return;
      }

      if (!db) {
        resolve();
        return;
      }

      db.run(
        `INSERT OR REPLACE INTO repositories (
          name, full_name, description, html_url, clone_url, homepage,
          language, languages, stargazers_count, forks_count, updated_at,
          created_at, topics, readme, docker_base_image, django_version,
               react_version, drupal_version, wordpress_version, dependabot_critical_count, owner, team, all_teams, dependabot_access, dependabot_permissions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        Object.values(repoData),
        (err) => {
          if (err) {
            console.error('Database error saving repository:', err);
          }
          resolve();
        }
      );
    });
  }

  // Get all repositories from database or in-memory storage
  getRepositories() {
    return new Promise((resolve) => {
      if (!this.useDatabase) {
        // Get from in-memory storage
        const repositories = Array.from(this.memoryRepositories.values())
          .sort((a, b) => {
            const dateA = new Date(a.updated_at || 0);
            const dateB = new Date(b.updated_at || 0);
            return dateB - dateA; // Descending order
          });
        
        // Debug: log first repository sample data
        if (repositories.length > 0) {
          console.log('🔍 Sample repo from memory:', {
            name: repositories[0].name,
            dependabot_critical_count: repositories[0].dependabot_critical_count
          });
        }
        
        resolve(repositories);
        return;
      }

      if (!db) {
        resolve([]);
        return;
      }

      db.all('SELECT * FROM repositories ORDER BY updated_at DESC', (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          resolve([]);
          return;
        }
        
        const repositories = rows.map(row => ({
          ...row,
          languages: JSON.parse(row.languages || '{}'),
          topics: JSON.parse(row.topics || '[]'),
          all_teams: JSON.parse(row.all_teams || '[]'),
          dependabot_permissions: JSON.parse(row.dependabot_permissions || '[]')
        }));
        
        // Debug: log first repository sample data
        if (repositories.length > 0) {
          console.log('🔍 Sample repo from DB:', {
            name: repositories[0].name,
            dependabot_critical_count: repositories[0].dependabot_critical_count
          });
        }
        
        resolve(repositories);
      });
    });
  }
}

// Initialize dependencies (includes new unified cache manager with Redis support)
// This replaces the old DatabaseCacheManager
// Note: initializeDependencies is now async, so we need to await it
let dependencies = null;
// Cache manager reference for legacy functions - will be set after initialization
let cacheManager = null;
let cacheRepository = null;

initializeDependencies().then(deps => {
  dependencies = deps;
  
  // Create legacy cache manager wrapper for compatibility
  cacheManager = {
    // Unified cache manager methods
    get: (key) => deps.cacheManager.get(key),
    set: (key, value, ttl) => deps.cacheManager.set(key, value, ttl),
    
    // Cache key generation
    getCacheKey: (repoName, dataType) => `${repoName}:${dataType}`,
    
    // Request deduplication
    deduplicateRequest: (key, fn) => deps.cacheManager.deduplicateRequest(key, fn),
    
    // Repository methods (from repositoryRepository)
    getRepositories: (options) => deps.repositoryRepository.getAllRepositories(options),
    saveRepository: (repo) => deps.repositoryRepository.saveRepository(repo),
    
    // Stats method
    getStats: () => deps.cacheManager.getStats()
  };
  
  cacheRepository = deps.cacheRepository;
  console.log('✅ All dependencies initialized');
  
  // Use new architecture routes - must be registered after dependencies are initialized
  app.use(dependencies.repositoryRoutes);
  app.use(dependencies.dockerRoutes);
  app.use(dependencies.drupalRoutes);
  app.use(dependencies.djangoRoutes);
  app.use(dependencies.wordpressRoutes);
  app.use(dependencies.reactRoutes);
  app.use(dependencies.dependabotRoutes);
  app.use(dependencies.languagesRoutes);
  app.use(dependencies.dashboardRoutes);
  app.use(dependencies.hdsRoutes);
  app.use(dependencies.usersRoutes);
  app.use(dependencies.branchesRoutes);
  app.use(dependencies.releasesRoutes);
  app.use(dependencies.contentsRoutes);
  app.use(dependencies.commitsRoutes);
  app.use(dependencies.teamsRoutes);
  app.use(dependencies.collaboratorsRoutes);
  app.use(dependencies.issuesRoutes);
  app.use(dependencies.pullRequestsRoutes);
  
  console.log('✅ Routes registered:', [
    '/repositories',
    '/api/repos',
    '/commits',
    '/teams',
    '/collaborators',
    '/issues',
    '/pull-requests'
  ].join(', '));
  
  // Register 404 handler AFTER all routes
  app.use((req, res) => {
    res.status(404).render('error', {
      message: 'Sivua ei löytynyt',
      error: { status: 404 }
    });
  });
  
  // Start server only after dependencies are initialized and routes are registered
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Failed to initialize dependencies:', err);
  process.exit(1);
});

// Clean expired cache entries periodically (using new cache manager)
const cleanupInterval = config.cache.cleanupInterval || 600000; // Default 10 minutes
setInterval(() => {
  if (dependencies && dependencies.cacheManager) {
    dependencies.cacheManager.cleanExpired().catch(err => {
      console.error('Cache cleanup error:', err.message);
    });
  }
}, cleanupInterval);

console.log(`🧹 Cache cleanup scheduled every ${cleanupInterval / 1000 / 60} minutes`);

// Helper function to find all Dockerfiles in a repository
async function findAllDockerfiles(ownerLogin, repoName) {
  const dockerfiles = [];
  
  try {
    // Common Dockerfile locations and names (only production/main Dockerfiles)
    const dockerfilePaths = [
      'Dockerfile',
      'Dockerfile.prod',
      'docker/Dockerfile',
      'docker/Dockerfile.prod',
      'build/Dockerfile',
      'deploy/Dockerfile',
      '.docker/Dockerfile'
    ];
    
    console.log(`🔍 Etsitään Dockerfile-tiedostoja reposta ${repoName}...`);
    
    // Check each potential Dockerfile path
    for (const dockerfilePath of dockerfilePaths) {
      try {
        console.log(`📁 Tarkistetaan: ${dockerfilePath}`);
        const response = await rateLimiter.makeRequest(
          `${GITHUB_API_BASE}/repos/${ownerLogin}/${repoName}/contents/${dockerfilePath}`
        );
        
        if (response.data && response.data.content) {
          console.log(`✅ Dockerfile löytyi: ${dockerfilePath}`);
          dockerfiles.push({
            path: dockerfilePath,
            content: Buffer.from(response.data.content, 'base64').toString('utf-8')
          });
        }
      } catch (error) {
        // File doesn't exist, continue to next
        if (error.response && error.response.status === 404) {
          console.log(`❌ Ei löytynyt: ${dockerfilePath}`);
        } else {
          console.log(`⚠️ Virhe tarkistettaessa ${dockerfilePath}: ${error.message}`);
        }
      }
    }
    
    // Also search for Dockerfiles using GitHub's search API
    try {
      console.log(`🔍 Haetaan Dockerfile-tiedostoja GitHub Search API:lla...`);
      const searchResponse = await rateLimiter.makeRequest(
        `${GITHUB_API_BASE}/search/code`,
        {
          params: {
            q: `filename:Dockerfile repo:${ownerLogin}/${repoName}`,
            per_page: 10
          }
        }
      );
      
      if (searchResponse.data && searchResponse.data.items) {
        console.log(`🔍 GitHub Search löysi ${searchResponse.data.items.length} Dockerfile-tiedostoa`);
        
        for (const item of searchResponse.data.items) {
          // Skip if we already found this file
          if (dockerfiles.some(df => df.path === item.path)) {
            continue;
          }
          
          try {
            console.log(`📁 Haetaan sisältö: ${item.path}`);
            const fileResponse = await rateLimiter.makeRequest(
              `${GITHUB_API_BASE}/repos/${ownerLogin}/${repoName}/contents/${item.path}`
            );
            
            if (fileResponse.data && fileResponse.data.content) {
              console.log(`✅ Dockerfile sisältö haettu: ${item.path}`);
              dockerfiles.push({
                path: item.path,
                content: Buffer.from(fileResponse.data.content, 'base64').toString('utf-8')
              });
            }
          } catch (fileError) {
            console.log(`⚠️ Virhe haettaessa ${item.path}: ${fileError.message}`);
          }
        }
      }
    } catch (searchError) {
      console.log(`⚠️ GitHub Search API virhe: ${searchError.message}`);
    }
    
    console.log(`📊 Yhteensä ${dockerfiles.length} Dockerfile-tiedostoa löytyi reposta ${repoName}`);
    return dockerfiles;
    
  } catch (error) {
    console.log(`❌ Virhe Dockerfile-tiedostojen haussa reposta ${repoName}: ${error.message}`);
    return [];
  }
}

// Helper: fetch a single likely Dockerfile and extract primary base images (lightweight)
async function getSingleDockerfileForRepo(repo) {
  try {
    const ownerLogin = (repo.owner && repo.owner.login) || (repo.full_name ? repo.full_name.split('/')[0] : null);
    if (!ownerLogin || !repo.name) return null;

    // Minimal set of probable locations; try root Dockerfile first, then docker/Dockerfile
    const candidatePaths = ['Dockerfile', 'docker/Dockerfile'];

    for (const dockerfilePath of candidatePaths) {
      try {
        const { data } = await axios.get(
          `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}/contents/${dockerfilePath}`,
          { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'Application-Portfolio' } }
        );

        if (data && data.type === 'file' && data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf8');
          const baseImages = extractBaseImages(content, dockerfilePath);
          return {
            path: dockerfilePath,
            baseImages
          };
        }
      } catch (err) {
        // Not found, try next candidate
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error(`❌ Virhe yksittäisen Dockerfilen haussa reposta ${repo.name}:`, error.message);
    return null;
  }
}

// Helper function to extract base images from Dockerfile content
function extractBaseImages(dockerfileContent, dockerfilePath) {
  const baseImages = [];
  
  // Find all FROM lines
  const fromMatches = dockerfileContent.match(/^FROM\s+([^\s#\n]+)/gm);
  
  if (fromMatches) {
    console.log(`🐳 Löytyi ${fromMatches.length} FROM-riviä tiedostosta ${dockerfilePath}`);
    
    fromMatches.forEach((match, index) => {
      let baseImage = match.replace(/^FROM\s+/, '');
      
      // Clean up image name (remove tags, digests, etc.)
      baseImage = baseImage.replace(/@sha256:[a-f0-9]+$/, ''); // Remove digest
      baseImage = baseImage.replace(/:[^:]+$/, ''); // Remove tag (keep only name)
      
      // Handle multi-stage builds
      if (baseImage.includes(' as ')) {
        baseImage = baseImage.split(' as ')[0];
      }
      
      console.log(`🎯 Base image ${index + 1} tiedostosta ${dockerfilePath}: ${baseImage}`);
      baseImages.push({
        image: baseImage,
        dockerfile: dockerfilePath,
        line: index + 1
      });
    });
  } else {
    console.log(`❌ FROM-rivejä ei löytynyt tiedostosta ${dockerfilePath}`);
  }
  
  return baseImages;
}

// Track repositories with missing owner data to avoid spam logging
const missingOwnerRepos = new Set();

// Helper function to safely get owner login
function getOwnerLogin(repo) {
  if (!repo || !repo.owner || !repo.owner.login) {
    // Use GITHUB_ORG as fallback when owner data is missing
    return GITHUB_ORG;
  }
  return repo.owner.login;
}

// Helper function to log missing owner data only once per repo (deprecated - using GITHUB_ORG fallback)
function logMissingOwner(repoName, functionName) {
  // This function is no longer needed since we use GITHUB_ORG as fallback
  // Keeping it for backward compatibility but it won't log anything
}

// Helper function to log summary of missing owner data
function logMissingOwnerSummary() {
  if (missingOwnerRepos.size > 0) {
    console.log(`📊 Yhteensä ${missingOwnerRepos.size} repositoryä puuttuu owner-tietoja`);
    console.log(`💡 Tämä on normaalia - jotkut repositoryt eivät sisällä owner-tietoja GitHub API:n vastauksessa`);
  }
}

// Helper function to check if repo has valid owner data
function hasValidOwner(repo) {
  return !!(repo && repo.owner && repo.owner.login);
}

// Helper function to safely make API requests with owner validation
async function safeApiRequest(repo, endpoint, options = {}) {
  const ownerLogin = getOwnerLogin(repo);
  if (!ownerLogin) {
    throw new Error(`Repository ${repo.name} missing owner information`);
  }
  
  const fullUrl = endpoint.startsWith('http') ? endpoint : `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}${endpoint}`;
  return await rateLimiter.makeRequest(fullUrl, options);
}

// Enhanced error handling wrapper for data fetching functions
function withErrorHandling(fn, functionName) {
  return async function(repo) {
    try {
      return await fn(repo);
    } catch (error) {
      console.error(`❌ Virhe ${functionName}-tietojen haussa reposta ${repo.name}:`, error.message);
      
      // Log more details for debugging
      if (error.message.includes('missing owner information')) {
        console.log(`⚠️ Repository ${repo.name} ei sisällä owner-tietoja`);
      } else if (error.message.includes('404')) {
        console.log(`📄 Tiedosto ei löytynyt reposta ${repo.name}`);
      } else if (error.message.includes('403')) {
        console.log(`🔒 Ei pääsyä repoon ${repo.name}`);
      }
      
      return null;
    }
  };
}

// Hae Django-versio repositorylle
async function getDjangoDataForRepo(repo) {
  try {
    if (repo.language !== 'Python') {
      return null;
    }
    
    const ownerLogin = getOwnerLogin(repo);
    
    const djangoCacheKey = cacheManager.getCacheKey(repo.name, 'django_version');
    let djangoVersion = await cacheManager.get(djangoCacheKey);
    
    if (!djangoVersion) {
      // Kokeile ensin requirements.txt
      try {
        const requirementsResponse = await rateLimiter.makeRequest(
          `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}/contents/requirements.txt`
        );
        const requirementsContent = Buffer.from(requirementsResponse.data.content, 'base64').toString('utf-8');
        
        // Etsi Django-rivi requirements.txt:stä (case-insensitive)
        const djangoMatch = requirementsContent.match(/^[Dd]jango[>=<]+([^\s#\n]+)/m);
        if (djangoMatch) {
          djangoVersion = djangoMatch[1];
        } else {
          // Kokeile ilman == merkkiä
          const djangoMatch2 = requirementsContent.match(/^[Dd]jango\s+([^\s#\n]+)/m);
          if (djangoMatch2) {
            djangoVersion = djangoMatch2[1];
          }
        }
      } catch (requirementsError) {
        // requirements.txt ei löytynyt, kokeile pyproject.toml
        try {
          const pyprojectResponse = await rateLimiter.makeRequest(
            `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}/contents/pyproject.toml`
          );
          const pyprojectContent = Buffer.from(pyprojectResponse.data.content, 'base64').toString('utf-8');
          
          // Etsi Django pyproject.toml:sta (case-insensitive)
          const djangoMatch = pyprojectContent.match(/[Dd]jango[>=<]+["']?([^"'\s,]+)["']?/);
          if (djangoMatch) {
            djangoVersion = djangoMatch[1];
          }
        } catch (pyprojectError) {
          // Ei löytynyt
        }
      }
      
      // Cache the result
      await cacheManager.set(djangoCacheKey, djangoVersion, 43200000); // 12h cache
    }
    
    return djangoVersion;
  } catch (error) {
    console.error(`❌ Virhe Django-tietojen haussa reposta ${repo.name}:`, error.message);
    return null;
  }
}

// Hae React-versio repositorylle
async function getReactDataForRepo(repo) {
  try {
    if (repo.language !== 'JavaScript' && repo.language !== 'TypeScript') {
      return null;
    }
    
    const ownerLogin = getOwnerLogin(repo);
    
    const reactCacheKey = cacheManager.getCacheKey(repo.name, 'react_version');
    let reactVersion = await cacheManager.get(reactCacheKey);
    
    if (!reactVersion) {
      try {
        const packageResponse = await rateLimiter.makeRequest(
          `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}/contents/package.json`
        );
        const packageContent = Buffer.from(packageResponse.data.content, 'base64').toString('utf-8');
        const packageJson = JSON.parse(packageContent);
        
        // Etsi React package.json:sta
        if (packageJson.dependencies && packageJson.dependencies.react) {
          reactVersion = packageJson.dependencies.react.replace(/[\^~]/, '');
        } else if (packageJson.devDependencies && packageJson.devDependencies.react) {
          reactVersion = packageJson.devDependencies.react.replace(/[\^~]/, '');
        }
      } catch (packageError) {
        // package.json ei löytynyt tai ei pääsyä
      }
      
      // Cache the result
      await cacheManager.set(reactCacheKey, reactVersion, 43200000); // 12h cache
    }
    
    return reactVersion;
  } catch (error) {
    console.error(`❌ Virhe React-tietojen haussa reposta ${repo.name}:`, error.message);
    return null;
  }
}

// Hae Drupal-versio repositorylle
async function getDrupalDataForRepo(repo) {
  try {
    if (repo.language !== 'PHP') {
      return null;
    }
    
    const ownerLogin = getOwnerLogin(repo);
    
    const drupalCacheKey = cacheManager.getCacheKey(repo.name, 'drupal_version');
    let drupalVersion = await cacheManager.get(drupalCacheKey);
    
    if (!drupalVersion) {
      const requestKey = `composer_${ownerLogin}_${repo.name}`;
      drupalVersion = await cacheManager.deduplicateRequest(requestKey, async () => {
        try {
          const composerResponse = await rateLimiter.makeRequest(
            `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}/contents/composer.json`
          );
          const composerContent = Buffer.from(composerResponse.data.content, 'base64').toString('utf-8');
          const composerJson = JSON.parse(composerContent);
          
          // Etsi Drupal composer.json:sta (tuki eri muodoille)
          let version = null;
          
          // Tarkista drupal/core ensin (Drupal 8+)
          if (composerJson.require && composerJson.require['drupal/core']) {
            version = composerJson.require['drupal/core'];
          } else if (composerJson.require && composerJson.require['drupal/drupal']) {
            // Drupal 7 ja vanhemmat
            version = composerJson.require['drupal/drupal'];
          } else if (composerJson.require) {
            // Etsi drupal/* paketteja (priorisoi core-paketteja)
            const drupalPackages = Object.entries(composerJson.require)
              .filter(([packageName, packageVersion]) => 
                packageName.startsWith('drupal/') && 
                packageName !== 'drupal/core-recommended' &&
                packageName !== 'drupal/console'
              )
              .sort(([a], [b]) => {
                // Priorisoi core-paketteja
                if (a.includes('core') && !b.includes('core')) return -1;
                if (!a.includes('core') && b.includes('core')) return 1;
                return 0;
              });
            
            if (drupalPackages.length > 0) {
              version = drupalPackages[0][1];
            }
          }
          
          // Siivoa versio (poista ^, ~, jne.)
          if (version) {
            // Poista version constraints
            version = version.replace(/[\^~>=<]+/, '');
            
            // Poista dev, alpha, beta, rc versiot
            if (version.includes('-')) {
              version = version.split('-')[0];
            }
            
            // Tarkista että versio on validi (numeroita ja pisteitä)
            if (!/^\d+\.\d+/.test(version)) {
              version = null;
            }
            
            // Normalisoi Drupal-versio (esim. 9.5.0 -> 9.5)
            if (version && version.split('.').length === 3) {
              const parts = version.split('.');
              if (parts[2] === '0') {
                version = parts.slice(0, 2).join('.');
              }
            }

            // Drupalissa ei ole 2.x tai 3.x versioita: hylkää epäkelvot (sallitut 7.x, 8.x, 9.x, 10.x, 11.x ...)
            if (version) {
              const major = parseInt(version.split('.')[0], 10);
              if (Number.isNaN(major) || major < 7) {
                version = null;
              }
            }
          }
          
          return version;
        } catch (composerError) {
          return null;
        }
      });
      
      // Cache the result
      await cacheManager.set(drupalCacheKey, drupalVersion, 43200000); // 12h cache
    }
    
    return drupalVersion;
  } catch (error) {
    console.error(`❌ Virhe Drupal-tietojen haussa reposta ${repo.name}:`, error.message);
    return null;
  }
}

// Hae WordPress-versio repositorylle
async function getWordPressDataForRepo(repo) {
  try {
    if (repo.language !== 'PHP') {
      return null;
    }
    
    const ownerLogin = getOwnerLogin(repo);
    
    const wordpressCacheKey = cacheManager.getCacheKey(repo.name, 'wordpress_version');
    let wordpressVersion = await cacheManager.get(wordpressCacheKey);
    
    if (!wordpressVersion) {
      // Try composer.json first
      try {
        const composerResponse = await rateLimiter.makeRequest(
          `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}/contents/composer.json`
        );
        const composerContent = Buffer.from(composerResponse.data.content, 'base64').toString('utf-8');
        const composerJson = JSON.parse(composerContent);
        
        // Check for WordPress packages
        let version = null;
        
        // Check johnpbloch/wordpress-core (Bedrock-style)
        if (composerJson.require && composerJson.require['johnpbloch/wordpress-core']) {
          version = composerJson.require['johnpbloch/wordpress-core'];
        } 
        // Check wordpress/wordpress
        else if (composerJson.require && composerJson.require['wordpress/wordpress']) {
          version = composerJson.require['wordpress/wordpress'];
        }
        // Check for WordPress in require-dev
        else if (composerJson['require-dev'] && composerJson['require-dev']['johnpbloch/wordpress-core']) {
          version = composerJson['require-dev']['johnpbloch/wordpress-core'];
        }
        
        // Clean version (remove ^, ~, >=, etc.)
        if (version) {
          version = version.replace(/[\^~>=<]+/, '');
          // Remove dev, alpha, beta, rc versions
          if (version.includes('-')) {
            version = version.split('-')[0];
          }
          // Validate version format
          if (/^\d+\.\d+(\.\d+)?$/.test(version)) {
            wordpressVersion = version;
          }
        }
      } catch (composerError) {
        // composer.json not found or error, try wp-config.php or version.php
      }
      
      // Try wp-config.php if composer.json didn't work
      if (!wordpressVersion) {
        try {
          const wpConfigResponse = await rateLimiter.makeRequest(
            `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}/contents/wp-config.php`
          );
          const wpConfigContent = Buffer.from(wpConfigResponse.data.content, 'base64').toString('utf-8');
          
          // Look for $wp_version or WP_VERSION constant
          const versionMatch = wpConfigContent.match(/(?:WP_VERSION|\\$wp_version)\s*[=:]\s*['"]([^'"]+)['"]/);
          if (versionMatch) {
            wordpressVersion = versionMatch[1];
          }
        } catch (wpConfigError) {
          // wp-config.php not found, try version.php
          try {
            const versionResponse = await rateLimiter.makeRequest(
              `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}/contents/wp-includes/version.php`
            );
            const versionContent = Buffer.from(versionResponse.data.content, 'base64').toString('utf-8');
            
            // Look for $wp_version variable
            const versionMatch = versionContent.match(/\\$wp_version\s*=\s*['"]([^'"]+)['"]/);
            if (versionMatch) {
              wordpressVersion = versionMatch[1];
            }
          } catch (versionError) {
            // Neither file found
          }
        }
      }
      
      // Cache the result
      await cacheManager.set(wordpressCacheKey, wordpressVersion, 43200000); // 12h cache
    }
    
    return wordpressVersion;
  } catch (error) {
    console.error(`❌ Virhe WordPress-tietojen haussa reposta ${repo.name}:`, error.message);
    return null;
  }
}

// Hae tiimitieto repositorylle GitHub API:sta
async function getTeamDataForRepo(repo) {
  try {
    const ownerLogin = getOwnerLogin(repo);
    
    const teamCacheKey = cacheManager.getCacheKey(repo.name, 'teams');
    let teamData = await cacheManager.get(teamCacheKey);
    
    if (teamData === null) {
      const requestKey = `teams_${ownerLogin}_${repo.name}`;
      teamData = await cacheManager.deduplicateRequest(requestKey, async () => {
        try {
          const teamsResp = await rateLimiter.makeRequest(
            `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}/teams`
          );
          
          const teams = teamsResp.data || [];
          const teamNames = teams.map(team => team.name || team.slug).filter(name => name);
          
          return {
            owner: ownerLogin,
            team: teamNames.length > 0 ? teamNames[0] : null,
            all_teams: teamNames
          };
        } catch (teamError) {
          // Jos ei pääsyä tiimeihin, käytä owner-loginia
          if (teamError.response?.status === 403 || teamError.response?.status === 404) {
            console.log(`⚠️ Tiimitieto ei saatavilla reposta: ${repo.name}`);
          }
          return {
            owner: ownerLogin,
            team: null,
            all_teams: []
          };
        }
      });
      
      // Cache the result for 24 hours
      await cacheManager.set(teamCacheKey, teamData, 86400000);
    }
    
    return teamData;
  } catch (error) {
    console.error(`❌ Virhe tiimitietojen haussa reposta ${repo.name}:`, error.message);
    const ownerLogin = getOwnerLogin(repo);
    return {
      owner: ownerLogin,
      team: null,
      all_teams: []
    };
  }
}

// Hae Dependabot-tiedot repositorylle
async function getDependabotDataForRepo(repo) {
  try {
    const ownerLogin = getOwnerLogin(repo);

    const dependabotCacheKey = cacheManager.getCacheKey(repo.name, 'dependabot_critical');
    let dependabotCriticalCount = await cacheManager.get(dependabotCacheKey);
    
    if (dependabotCriticalCount === null) {
      const requestKey = `dependabot_${ownerLogin}_${repo.name}`;
      dependabotCriticalCount = await cacheManager.deduplicateRequest(requestKey, async () => {
        try {
          let totalCritical = 0;
          let page = 1;
          
          // Hae kaikki kriittiset ilmoitukset sivutettuna
          while (true) {
            const alertsResp = await rateLimiter.makeRequest(
              `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}/dependabot/alerts`,
              {
                params: { 
                  per_page: 100, 
                  page: page, 
                  severity: 'critical', 
                  state: 'open' 
                }
              }
            );
            
            const alerts = alertsResp.data || [];
            totalCritical += alerts.length;
            
            // Jos alle 100 ilmoitusta, ollaan viimeisellä sivulla
            if (alerts.length < 100) break;
            page += 1;
            
            // Turvallisuus: max 10 sivua (1000 ilmoitusta)
            if (page > 10) break;
          }
          
          return totalCritical;
        } catch (dependabotError) {
          // Jos Dependabot ei ole käytössä tai ei pääsyä
          if (dependabotError.response?.status === 403) {
            console.log(`⚠️ Dependabot ei käytössä repossa: ${repo.name}`);
          } else if (dependabotError.response?.status === 404) {
            console.log(`⚠️ Dependabot ei löytynyt reposta: ${repo.name}`);
          }
          return 0;
        }
      });
      
      // Cache the result
      await cacheManager.set(dependabotCacheKey, dependabotCriticalCount, 21600000); // 6h cache
    }
    
    return dependabotCriticalCount;
  } catch (error) {
    console.error(`❌ Virhe Dependabot-tietojen haussa reposta ${repo.name}:`, error.message);
    return 0;
  }
}

// Hae viimeisimmän commitin tiedot repositorylle
async function getLatestCommitData(ownerLogin, repoName) {
  try {
    const cacheKey = `latest_commit_data_${ownerLogin}_${repoName}`;
    let cachedData = await cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    console.log(`🔍 Haetaan viimeisin commit reposta: ${ownerLogin}/${repoName}`);
    
    const commitsResp = await rateLimiter.makeRequest(
      `${GITHUB_API_BASE}/repos/${ownerLogin}/${repoName}/commits`,
      {
        params: {
          per_page: 1,
          page: 1
        }
      }
    );
    
    let commitData = {
      author: null,
      message: null,
      date: null,
      sha: null
    };
    
    if (commitsResp.data && commitsResp.data.length > 0) {
      const lastCommit = commitsResp.data[0];
      
      commitData.sha = lastCommit.sha;
      
      // Hae author (käyttäjänimi tai nimi)
      if (lastCommit.author && lastCommit.author.login) {
        commitData.author = lastCommit.author.login;
      } else if (lastCommit.commit && lastCommit.commit.author) {
        commitData.author = lastCommit.commit.author.name;
      }
      
      // Hae commit message
      if (lastCommit.commit && lastCommit.commit.message) {
        commitData.message = lastCommit.commit.message.split('\n')[0]; // Ensimmäinen rivi
      }
      
      // Hae päivämäärä
      if (lastCommit.commit && lastCommit.commit.author) {
        commitData.date = lastCommit.commit.author.date;
      }
      
      console.log(`✅ Latest commit for ${repoName}: ${commitData.author} - ${commitData.message?.substring(0, 50)}...`);
    }
    
    // Cache the result for 24 hours
    await cacheManager.set(cacheKey, commitData, 24 * 60 * 60 * 1000);
    
    return commitData;
  } catch (error) {
    console.log(`⚠️ Could not fetch last commit for ${repoName}: ${error.message}`);
    return { author: null, message: null, date: null, sha: null };
  }
}

// Hae HDS-versio repositorylle
async function getHDSDataForRepo(repo) {
  try {
    const ownerLogin = getOwnerLogin(repo);

    // Check if it's a frontend repository
    if (!['JavaScript', 'TypeScript', 'HTML', 'CSS', 'SCSS', 'Vue', 'React'].includes(repo.language)) {
      return null;
    }

    const cacheKey = `hds_${ownerLogin}_${repo.name}`;
    
    // Check cache first
    let cachedData = await cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    console.log(`🔍 Haetaan HDS-tietoja reposta: ${repo.name}`);
    
    try {
      const response = await rateLimiter.makeRequest(
        `https://api.github.com/repos/${ownerLogin}/${repo.name}/contents/package.json`
      );
      
      const packageContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
      const packageJson = JSON.parse(packageContent);
      
      const hdsVersions = {};
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check for specific HDS packages
      const hdsPackageNames = [
        'hds-core',
        'hds-react',
        'hds-design-tokens',
        'hds-icons',
        'hds-toolkit',
        'helsinki-design-system'
      ];
      
      hdsPackageNames.forEach(packageName => {
        if (dependencies[packageName]) {
          hdsVersions[packageName] = dependencies[packageName];
        }
      });

      const data = {
        has_hds: Object.keys(hdsVersions).length > 0,
        hds_packages: hdsVersions,
        package_count: Object.keys(hdsVersions).length
      };

      if (data.has_hds) {
        console.log(`✅ HDS löytyi reposta ${repo.name}:`, Object.keys(hdsVersions));
      }

      await cacheManager.set(cacheKey, data, 24 * 60 * 60 * 1000); // 24h cache
      return data;
      
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`📄 package.json ei löytynyt reposta ${repo.name}`);
      } else if (error.response && error.response.status === 403) {
        console.log(`🔒 Ei pääsyä repoon ${repo.name}`);
      } else {
        console.log(`⚠️ Virhe HDS-haussa reposta ${repo.name}:`, error.message);
      }
      return null;
    }
  } catch (error) {
    console.error(`❌ Virhe HDS-tietojen haussa reposta ${repo.name}:`, error.message);
    return null;
  }
}

// Hae Docker-tiedot repositorylle
async function getDockerDataForRepo(repo) {
  try {
    console.log(`🔍 Docker-haku aloitettu reposta: ${repo.name}`);
    
    const ownerLogin = getOwnerLogin(repo);
    console.log(`✅ Owner löytyi: ${ownerLogin} reposta ${repo.name}`);
    
    const dockerCacheKey = cacheManager.getCacheKey(repo.name, 'docker_base_images');
    let dockerData = await cacheManager.get(dockerCacheKey);
    
    console.log(`💾 Cache-tarkistus reposta ${repo.name}: ${dockerData ? 'Löytyi' : 'Ei löytynyt'}`);
    
    if (!dockerData) {
      const requestKey = `dockerfiles_${ownerLogin}_${repo.name}`;
      console.log(`🌐 Haetaan kaikki Dockerfile-tiedostot reposta: ${ownerLogin}/${repo.name}`);
      
      dockerData = await cacheManager.deduplicateRequest(requestKey, async () => {
        try {
          // Find all Dockerfiles in the repository
          const dockerfiles = await findAllDockerfiles(ownerLogin, repo.name);
          
          if (dockerfiles.length === 0) {
            console.log(`❌ Ei Dockerfile-tiedostoja löytynyt reposta ${repo.name}`);
            return null;
          }
          
          // Extract base images from all Dockerfiles
          const allBaseImages = [];
          dockerfiles.forEach(dockerfile => {
            const baseImages = extractBaseImages(dockerfile.content, dockerfile.path);
            allBaseImages.push(...baseImages);
          });
          
          if (allBaseImages.length === 0) {
            console.log(`❌ Ei FROM-rivejä löytynyt Dockerfile-tiedostoista reposta ${repo.name}`);
            return null;
          }
          
          // Return primary base image (first FROM line from main Dockerfile)
          const primaryDockerfile = dockerfiles.find(df => df.path === 'Dockerfile') || dockerfiles[0];
          const primaryBaseImages = extractBaseImages(primaryDockerfile.content, primaryDockerfile.path);
          const primaryBaseImage = primaryBaseImages.length > 0 ? primaryBaseImages[0].image : null;
          
          const result = {
            primary: primaryBaseImage,
            all: allBaseImages,
            dockerfiles: dockerfiles.map(df => df.path),
            count: allBaseImages.length
          };
          
          console.log(`🎯 Docker-analyysi valmis reposta ${repo.name}:`);
          console.log(`   - Pääbase image: ${result.primary}`);
          console.log(`   - Kaikki base imageit: ${result.count} kpl`);
          console.log(`   - Dockerfile-tiedostot: ${result.dockerfiles.join(', ')}`);
          
          return result;
          
        } catch (error) {
          console.log(`❌ Dockerfile-haku epäonnistui reposta ${repo.name}: ${error.message}`);
          if (error.response) {
            console.log(`📊 HTTP status: ${error.response.status}`);
          }
          return null;
        }
      });
      
      // Cache the result
      await cacheManager.set(dockerCacheKey, dockerData, 86400000); // 24h cache
      console.log(`💾 Docker-tulos tallennettu cacheen reposta ${repo.name}`);
    }
    
    console.log(`✅ Docker-haku valmis reposta ${repo.name}: ${dockerData ? 'Löytyi' : 'Ei Dockerfileä'}`);
    return dockerData;
  } catch (error) {
    console.error(`❌ Virhe Docker-tietojen haussa reposta ${repo.name}:`, error.message);
    return null;
  }
}

// Hae kaikki organisaation repot sivutettuna ja suodata arkistoidut pois
async function getRecentRepositories() {
  try {
    console.log(`🔍 Haetaan repot organisaatiosta: ${GITHUB_ORG}`);
    
    // Check if we have cached repository list (cache for 1 hour)
    const reposCacheKey = `org_repos_${GITHUB_ORG}`;
    let allRepos = await cacheManager.get(reposCacheKey);
    
    if (!allRepos) {
      console.log(`💾 Repository lista ei löytynyt cachesta, haetaan API:sta...`);
      allRepos = [];
      let page = 1;
      
      try {
        while (true) {
          console.log(`📄 Haetaan sivu ${page}...`);
          const resp = await rateLimiter.makeRequest(`${GITHUB_API_BASE}/orgs/${GITHUB_ORG}/repos`, {
            params: {
              per_page: 100,
              page: page,
              type: 'all',
              sort: 'updated',
              direction: 'desc'
            }
          });
          const reposPage = resp.data || [];
          allRepos.push(...reposPage);
          console.log(`✅ Sivu ${page}: ${reposPage.length} reposta (yhteensä: ${allRepos.length})`);
          
          // Log rate limit status
          const status = rateLimiter.getRateLimitStatus();
          console.log(`📊 Rate limit: ${status.remaining}/${status.limit} jäljellä`);
          
          if (reposPage.length < 100) {
            console.log(`🏁 Viimeinen sivu saavutettu`);
            break;
          }
          page += 1;
        }
        
        // Cache the repository list for 1 hour
        await cacheManager.set(reposCacheKey, allRepos, 3600000);
        console.log(`💾 Repository lista tallennettu cacheen (${allRepos.length} reposta)`);
      } catch (error) {
        console.error(`❌ Virhe repository-listan haussa sivulla ${page}:`, error.message);
        throw error; // Re-throw to be handled by caller
      }
    } else {
      console.log(`💾 Repository lista löytyi cachesta (${allRepos.length} reposta)`);
    }

    console.log(`📊 Kaikki repot haettu: ${allRepos.length} kpl`);
    
    // Suodata pois arkistoidut
    const archivedCount = allRepos.filter(repo => repo.archived).length;
    let recentRepos = allRepos.filter(repo => !repo.archived);
    console.log(`🗃️ Arkistoitu: ${archivedCount}, Aktiivinen: ${recentRepos.length}`);
    
    // Apply repository limit for testing if set
    if (MAX_REPOSITORIES) {
      recentRepos = recentRepos.slice(0, MAX_REPOSITORIES);
      console.log(`🧪 TESTTILA: Rajoitettu ${MAX_REPOSITORIES} repositoryyn (alkuperäinen määrä: ${allRepos.filter(repo => !repo.archived).length})`);
    }

    // Hae lisätietoja jokaisesta reposta - batch processing
    console.log(`🔧 Rikastetaan ${recentRepos.length} reposta...`);
    
    // Dynamic batch size based on rate limit status (only if rate limiting is enabled)
    const getOptimalBatchSize = () => {
      if (!rateLimiter.enabled) {
        return 20; // Larger batches when rate limiting is disabled
      }
      
      const status = rateLimiter.getRateLimitStatus();
      if (status.remaining < 100) return 3;  // Very conservative
      if (status.remaining < 500) return 5;  // Conservative
      if (status.remaining < 1000) return 8; // Moderate
      return 10; // Normal
    };
    
    const reposWithDetails = [];
    
    for (let i = 0; i < recentRepos.length; i += getOptimalBatchSize()) {
      const batchSize = getOptimalBatchSize();
      const batch = recentRepos.slice(i, i + batchSize);
      console.log(`📦 Käsitellään batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(recentRepos.length/batchSize)} (${batch.length} reposta, batch size: ${batchSize})`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (repo, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            if (globalIndex % 10 === 0) {
              console.log(`⚙️ Käsitellään repo ${globalIndex + 1}/${recentRepos.length}: ${repo.name}`);
            }
            
            // Hae kielitiedot - cache 24h
            const languagesCacheKey = cacheManager.getCacheKey(repo.name, 'languages');
            let languagesData = await cacheManager.get(languagesCacheKey);
            
            if (!languagesData) {
              const ownerLogin = getOwnerLogin(repo);
              if (!ownerLogin) {
                logMissingOwner(repo.name, 'kielitietojen');
                return null;
              }
              
              const requestKey = `languages_${ownerLogin}_${repo.name}`;
              languagesData = await cacheManager.deduplicateRequest(requestKey, async () => {
                const languagesResponse = await rateLimiter.makeRequest(
                  `${GITHUB_API_BASE}/repos/${ownerLogin}/${repo.name}/languages`
                );
                return languagesResponse.data;
              });
              await cacheManager.set(languagesCacheKey, languagesData, 86400000); // 24h cache
            }

            // Skip README to reduce API calls
            let readme = null;
            
            // Skip Docker data fetching to improve performance
            let dockerBaseImage = null;

            // Skip framework and Dependabot data fetching to improve performance
            let djangoVersion = null;
            let reactVersion = null;
            let drupalVersion = null;
            let dependabotCriticalCount = 0;

            return {
              name: repo.name,
              full_name: repo.full_name,
              description: repo.description,
              html_url: repo.html_url,
              clone_url: repo.clone_url,
              homepage: repo.homepage,
              language: repo.language,
              languages: languagesData,
              stargazers_count: repo.stargazers_count,
              forks_count: repo.forks_count,
              updated_at: repo.updated_at,
              created_at: repo.created_at,
              topics: repo.topics || [],
              readme: readme,
              docker_base_image: dockerBaseImage,
              django_version: djangoVersion,
              react_version: reactVersion,
              drupal_version: drupalVersion,
              dependabot_critical_count: dependabotCriticalCount
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
              stargazers_count: repo.stargazers_count,
              forks_count: repo.forks_count,
              updated_at: repo.updated_at,
              created_at: repo.created_at,
              topics: repo.topics || [],
              languages: {},
              readme: null,
              docker_base_image: null,
              django_version: null,
              react_version: null,
              drupal_version: null
            };
          }
        })
      );
      
      // Handle Promise.allSettled results
      const successfulResults = batchResults
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
      
      const failedResults = batchResults
        .filter(result => result.status === 'rejected')
        .map(result => result.reason);
      
      if (failedResults.length > 0) {
        console.log(`⚠️ ${failedResults.length} reposta epäonnistui batchissa ${Math.floor(i/batchSize) + 1}`);
        failedResults.forEach(error => {
          console.error(`❌ Batch error:`, error.message);
        });
      }
      
      reposWithDetails.push(...successfulResults);
      
      // Log progress and rate limit status
      const status = rateLimiter.getRateLimitStatus();
      const progress = Math.round(((i + batchSize) / recentRepos.length) * 100);
      
      if (rateLimiter.enabled) {
        const estimatedTimeRemaining = status.remaining < 100 ? 'N/A (rate limited)' : 
          `${Math.round((recentRepos.length - i) / batchSize * 2)} min`;
        console.log(`📊 Edistyminen: ${progress}% | Rate limit: ${status.remaining}/${status.limit} | ETA: ${estimatedTimeRemaining}`);
      } else {
        console.log(`🚀 Edistyminen: ${progress}% | Rate limiting: DISABLED | ETA: ${Math.round((recentRepos.length - i) / batchSize * 0.5)} min`);
      }
      
      // Dynamic delay based on rate limit status
      if (i + batchSize < recentRepos.length) {
        let delay;
        if (!rateLimiter.enabled) {
          delay = 500; // Minimal delay when rate limiting is disabled
        } else {
          delay = status.remaining < 100 ? 5000 : status.remaining < 500 ? 3000 : 2000;
        }
        console.log(`⏸️ Tauko batchien välissä: ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log(`✅ Rikastus valmis: ${reposWithDetails.length} reposta`);
    
    // Save all repositories to database
    console.log(`💾 Tallennetaan ${reposWithDetails.length} reposta tietokantaan...`);
    for (const repo of reposWithDetails) {
      await cacheManager.saveRepository(repo);
    }
    console.log(`✅ Repot tallennettu tietokantaan`);
    
    return reposWithDetails;
  } catch (error) {
    console.error('❌ Virhe repojen haussa:', error.message);
    throw error;
  }
}


/* Legacy dashboard removed - handled by new architecture
app.get('/dashboard', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }
    
    // Check if we should refresh data from API or use cached data
    const refreshData = req.query.refresh === 'true';
    let repositories;
    
    if (refreshData) {
      try {
        repositories = await getRecentRepositories();
      } catch (error) {
        console.error('❌ Virhe repojen haussa:', error.message);
        repositories = [];
      }
    } else {
      try {
        repositories = await cacheManager.getRepositories();
        
        // Jos tietokannassa ei ole tietoja, hae API:sta
        if (repositories.length === 0) {
          try {
            repositories = await getRecentRepositories();
          } catch (error) {
            console.error('❌ Virhe repojen haussa:', error.message);
            repositories = [];
          }
        }
      } catch (dbError) {
        console.error('❌ Virhe tietokantaan tallennettujen tietojen haussa:', dbError.message);
        repositories = [];
      }
    }
    
    // Calculate language counts
    const languageCounts = {};
    repositories.forEach(repo => {
      if (repo.language) {
        languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
      }
    });
    
    const totalRepos = repositories.length;
    
    // 1. Turvallisuustilanne-yhteenveto (Dependabot)
    const totalCriticalAlerts = repositories.reduce((sum, repo) => {
      return sum + (repo.dependabot_critical_count || 0);
    }, 0);
    const reposWithAlerts = repositories.filter(repo => (repo.dependabot_critical_count || 0) > 0).length;
    const reposWithoutAlerts = totalRepos - reposWithAlerts;
    
    // 2. Framework/teknologia-yhteenveto
    const djangoRepos = repositories.filter(repo => repo.django_version).length;
    const reactRepos = repositories.filter(repo => repo.react_version).length;
    const drupalRepos = repositories.filter(repo => repo.drupal_version).length;
    const dockerRepos = repositories.filter(repo => repo.docker_base_image).length;
    
    // 3. Aktiivisuustilastot
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentlyUpdated = repositories.filter(repo => {
      if (!repo.updated_at) return false;
      const updatedDate = new Date(repo.updated_at);
      return updatedDate >= thirtyDaysAgo;
    }).length;
    
    // Note: archived flag might not be available in cached data
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
    
    // 4. Top repositoryt
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
    
    // 5. Organisaatiot/tiimit-yhteenveto
    const reposWithTeams = repositories.filter(repo => {
      const teams = repo.all_teams || (Array.isArray(repo.all_teams) ? repo.all_teams : JSON.parse(repo.all_teams || '[]'));
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
        } else {
          try {
            teams = JSON.parse(repo.all_teams || '[]');
          } catch (e) {
            teams = [];
          }
        }
      }
      teams.forEach(team => {
        teamStats[team] = (teamStats[team] || 0) + 1;
      });
    });
    const topTeams = Object.entries(teamStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    // 6. Helsinki Design System -käyttö
    // Need to fetch HDS data for repositories
    const frontendRepos = repositories.filter(repo => 
      ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'SCSS', 'Vue', 'React'].includes(repo.language)
    );
    
    // Check HDS data from cache (this might not be complete, but we'll try)
    let hdsReposCount = 0;
    const hdsVersions = {};
    for (const repo of frontendRepos.slice(0, 50)) { // Limit to avoid too many API calls
      try {
        const hdsData = await getHDSDataForRepo(repo);
        if (hdsData && hdsData.has_hds) {
          hdsReposCount++;
          Object.keys(hdsData.hds_packages || {}).forEach(pkg => {
            const version = hdsData.hds_packages[pkg];
            const versionKey = `${pkg}:${version}`;
            hdsVersions[versionKey] = (hdsVersions[versionKey] || 0) + 1;
          });
        }
      } catch (e) {
        // Skip if HDS data not available
      }
    }
    
    const topHDSVersions = Object.entries(hdsVersions)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([version, count]) => ({ version, count }));
    
    // 7. Repository-terveysindikaattorit
    // Simplified version using available data - can be enhanced with additional API calls if needed
    const reposWithDescription = repositories.filter(repo => repo.description && repo.description.trim().length > 0).length;
    const reposWithTopics = repositories.filter(repo => {
      const topics = repo.topics || (Array.isArray(repo.topics) ? repo.topics : JSON.parse(repo.topics || '[]'));
      return topics && topics.length > 0;
    }).length;
    const reposWithHomepage = repositories.filter(repo => repo.homepage && repo.homepage.trim().length > 0).length;
    
    // Calculate health score (0-100) based on available data
    // This is a simplified version - full implementation would check README, issues, PRs, CI/CD
    const healthMetrics = {
      withDescription: reposWithDescription,
      withTopics: reposWithTopics,
      withHomepage: reposWithHomepage,
      totalRepos: totalRepos
    };
    
    res.render('dashboard', {
      title: 'Dashboard',
      organization: GITHUB_ORG,
      repositories: repositories,
      totalRepos: totalRepos,
      languageCounts: languageCounts,
      
      // 1. Turvallisuustilanne
      totalCriticalAlerts: totalCriticalAlerts,
      reposWithAlerts: reposWithAlerts,
      reposWithoutAlerts: reposWithoutAlerts,
      
      // 2. Framework/teknologia
      djangoRepos: djangoRepos,
      reactRepos: reactRepos,
      drupalRepos: drupalRepos,
      dockerRepos: dockerRepos,
      
      // 3. Aktiivisuustilastot
      recentlyUpdated: recentlyUpdated,
      archivedRepos: archivedRepos,
      activeRepos: activeRepos,
      avgDaysSinceUpdate: avgDaysSinceUpdate,
      
      // 4. Top repositoryt
      topStars: topStars,
      topForks: topForks,
      topRecent: topRecent,
      
      // 5. Organisaatiot/tiimit
      reposWithTeams: reposWithTeams,
      reposWithoutTeams: reposWithoutTeams,
      topTeams: topTeams,
      
      // 6. HDS-käyttö
      hdsReposCount: hdsReposCount,
      frontendReposCount: frontendRepos.length,
      topHDSVersions: topHDSVersions,
      
      // 7. Repository-terveysindikaattorit
      healthMetrics: healthMetrics,
      
      getLanguageColor: getLanguageColor
    });
  } catch (error) {
    console.error('❌ Virhe etusivun latauksessa:', error);
    
    // Jos on 502-virhe, näytä ystävällisempi viesti
    if (error.response?.status === 502) {
      res.render('error', {
        message: 'GitHub API on väliaikaisesti poissa käytöstä (502 Bad Gateway). Yritä myöhemmin uudelleen.',
        error: { status: 502 }
      });
    } else {
      res.render('error', {
        message: 'Virhe etusivun latauksessa',
        error: { status: 500, stack: error.stack }
      });
    }
});*/

// Pääreitti - Etusivu (Tekstipohjainen yhteenveto, ei API-kutsuja)
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Etusivu',
    organization: GITHUB_ORG
  });
});

// Settings route - Application settings and configuration
app.get('/settings', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }

    console.log('⚙️ Aloitetaan Asetukset-sivun lataus...');
    
    // Get all repositories
    const githubRepos = await getRecentRepositories();
    console.log(`📦 GitHub repot haettu: ${githubRepos.length} kpl`);

    res.render('settings', {
      title: 'Asetukset - Sovellusasetukset',
      organization: GITHUB_ORG,
      githubRepos: githubRepos,
      getLanguageColor: getLanguageColor
    });
  } catch (error) {
    console.error('❌ Virhe Asetukset-sivun latauksessa:', error);
    res.render('error', {
      message: 'Virhe Asetukset-sivun latauksessa',
      error: { status: 500, stack: error.stack }
    });
  }
});

// Django route - Django applications page
app.get('/django', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }

    console.log('🐍 Aloitetaan Django-sivun lataus...');
    
    // Get all repositories
    const githubRepos = await getRecentRepositories();
    console.log(`📦 GitHub repot haettu: ${githubRepos.length} kpl`);
    
    // Check if we should refresh data from API or use cached data
    const refreshData = req.query.refresh === 'true';

    // Filter Python repositories and fetch Django data
    const pythonRepos = githubRepos.filter(repo => repo.language === 'Python');
    console.log(`🐍 Python-repositoryt: ${pythonRepos.length} kpl`);
    
    const djangoRepos = [];
    const noDjangoRepos = [];
    
    // Process Python repositories in batches
    const batchSize = 10;
    for (let i = 0; i < pythonRepos.length; i += batchSize) {
      const batch = pythonRepos.slice(i, i + batchSize);
      console.log(`📦 Käsitellään Django-batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(pythonRepos.length/batchSize)} (${batch.length} reposta)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          const djangoVersion = await getDjangoDataForRepo(repo);
          return {
            ...repo,
            django_version: djangoVersion
          };
        })
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const repo = result.value;
          if (repo.django_version) {
            djangoRepos.push(repo);
          } else {
            noDjangoRepos.push(repo);
          }
        } else {
          console.error(`❌ Django-tietojen haku epäonnistui reposta ${batch[index].name}:`, result.reason);
          noDjangoRepos.push(batch[index]);
        }
      });
      
      if (i + batchSize < pythonRepos.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Analyze Django versions
        const versionStats = {};
        djangoRepos.forEach(repo => {
          const version = repo.django_version;
          versionStats[version] = (versionStats[version] || 0) + 1;
        });

    const sortedVersions = Object.entries(versionStats)
      .sort(([,a], [,b]) => b - a)
      .map(([version, count]) => ({ 
          version, 
        count
      }));

    console.log(`🐍 Django-repositoryt: ${djangoRepos.length} kpl`);
    console.log(`📊 Eri Django-versioita: ${sortedVersions.length} kpl`);

    res.render('django', {
      title: 'Django - Python-sovellukset',
      organization: GITHUB_ORG,
      djangoRepos: djangoRepos,
      noDjangoRepos: noDjangoRepos,
      versionStats: sortedVersions,
      stats: {
        totalRepos: githubRepos.length,
        pythonRepos: pythonRepos.length,
        djangoRepos: djangoRepos.length,
        noDjangoRepos: noDjangoRepos.length,
        uniqueVersions: sortedVersions.length
      },
      getLanguageColor: getLanguageColor
    });

  } catch (error) {
    console.error('❌ Virhe Django-sivun latauksessa:', error);
    res.render('error', {
      message: 'Virhe Django-sivun latauksessa',
      error: { status: 500, stack: error.stack }
    });
  }
});

// React route - React applications page
app.get('/react', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }

    console.log('⚛️ Aloitetaan React-sivun lataus...');
    
    // Get all repositories
    const githubRepos = await getRecentRepositories();
    console.log(`📦 GitHub repot haettu: ${githubRepos.length} kpl`);

    const jsRepos = githubRepos.filter(repo => repo.language === 'JavaScript' || repo.language === 'TypeScript');
    console.log(`⚛️ JS/TS-repositoryt: ${jsRepos.length} kpl`);
    
    const reactRepos = [];
    const noReactRepos = [];
    
    const batchSize = 10;
    for (let i = 0; i < jsRepos.length; i += batchSize) {
      const batch = jsRepos.slice(i, i + batchSize);
      console.log(`📦 Käsitellään React-batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(jsRepos.length/batchSize)}`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          const reactVersion = await getReactDataForRepo(repo);
          return { ...repo, react_version: reactVersion };
        })
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const repo = result.value;
          if (repo.react_version) {
            reactRepos.push(repo);
          } else {
            noReactRepos.push(repo);
          }
        } else {
          noReactRepos.push(batch[index]);
        }
      });
      
      if (i + batchSize < jsRepos.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const versionStats = {};
    reactRepos.forEach(repo => {
      const version = repo.react_version;
      versionStats[version] = (versionStats[version] || 0) + 1;
    });

    const sortedVersions = Object.entries(versionStats)
      .sort(([,a], [,b]) => b - a)
      .map(([version, count]) => ({ version, count }));

    console.log(`⚛️ React-repositoryt: ${reactRepos.length} kpl`);

    res.render('react', {
      title: 'React - JavaScript-sovellukset',
      organization: GITHUB_ORG,
      reactRepos: reactRepos,
      noReactRepos: noReactRepos,
      versionStats: sortedVersions,
      stats: {
        totalRepos: githubRepos.length,
        jsRepos: jsRepos.length,
        reactRepos: reactRepos.length,
        noReactRepos: noReactRepos.length,
        uniqueVersions: sortedVersions.length
      },
      getLanguageColor: getLanguageColor
    });

  } catch (error) {
    console.error('❌ Virhe React-sivun latauksessa:', error);
    res.render('error', {
      message: 'Virhe React-sivun latauksessa',
      error: { status: 500, stack: error.stack }
    });
  }
});

/* Legacy drupal removed - handled by new architecture
app.get('/drupal', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }

    console.log('🌐 Aloitetaan Drupal-sivun lataus...');
    
    // Get all repositories
    const githubRepos = await getRecentRepositories();
    console.log(`📦 GitHub repot haettu: ${githubRepos.length} kpl`);

    const phpRepos = githubRepos.filter(repo => repo.language === 'PHP');
    console.log(`🌐 PHP-repositoryt: ${phpRepos.length} kpl`);
    
    const drupalRepos = [];
    const noDrupalRepos = [];
    
    const batchSize = 10;
    for (let i = 0; i < phpRepos.length; i += batchSize) {
      const batch = phpRepos.slice(i, i + batchSize);
      console.log(`📦 Käsitellään Drupal-batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(phpRepos.length/batchSize)}`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          const drupalVersion = await getDrupalDataForRepo(repo);
          return { ...repo, drupal_version: drupalVersion };
        })
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const repo = result.value;
          if (repo.drupal_version) {
            drupalRepos.push(repo);
          } else {
            noDrupalRepos.push(repo);
          }
        } else {
          noDrupalRepos.push(batch[index]);
        }
      });
      
      if (i + batchSize < phpRepos.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const versionStats = {};
    drupalRepos.forEach(repo => {
      const version = repo.drupal_version;
      versionStats[version] = (versionStats[version] || 0) + 1;
    });

    const sortedVersions = Object.entries(versionStats)
      .sort(([,a], [,b]) => b - a)
      .map(([version, count]) => ({ version, count }));

    console.log(`🌐 Drupal-repositoryt: ${drupalRepos.length} kpl`);

    res.render('drupal', {
      title: 'Drupal - PHP-sivustot',
      organization: GITHUB_ORG,
      drupalRepos: drupalRepos,
      noDrupalRepos: noDrupalRepos,
      versionStats: sortedVersions,
      stats: {
        totalRepos: githubRepos.length,
        phpRepos: phpRepos.length,
        drupalRepos: drupalRepos.length,
        noDrupalRepos: noDrupalRepos.length,
        uniqueVersions: sortedVersions.length
      },
      getLanguageColor: getLanguageColor
    });

  } catch (error) {
    console.error('❌ Virhe Drupal-sivun latauksessa:', error);
    res.render('error', {
      message: 'Virhe Drupal-sivun latauksessa',
      error: { status: 500, stack: error.stack }
    });
});*/

// WordPress route - WordPress sites page
app.get('/wordpress', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }

    console.log('📝 Aloitetaan WordPress-sivun lataus...');
    
    // Get all repositories
    const githubRepos = await getRecentRepositories();
    console.log(`📦 GitHub repot haettu: ${githubRepos.length} kpl`);

    const phpRepos = githubRepos.filter(repo => repo.language === 'PHP');
    console.log(`🌐 PHP-repositoryt: ${phpRepos.length} kpl`);
    
    const wordpressRepos = [];
    const noWordPressRepos = [];
    
    const batchSize = 10;
    for (let i = 0; i < phpRepos.length; i += batchSize) {
      const batch = phpRepos.slice(i, i + batchSize);
      console.log(`📦 Käsitellään WordPress-batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(phpRepos.length/batchSize)}`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          const wordpressVersion = await getWordPressDataForRepo(repo);
          return { ...repo, wordpress_version: wordpressVersion };
        })
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const repo = result.value;
          if (repo.wordpress_version) {
            wordpressRepos.push(repo);
          } else {
            noWordPressRepos.push(repo);
          }
        } else {
          noWordPressRepos.push(batch[index]);
        }
      });
      
      if (i + batchSize < phpRepos.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Analyze WordPress versions
    const versionStats = {};
    wordpressRepos.forEach(repo => {
      const version = repo.wordpress_version;
      versionStats[version] = (versionStats[version] || 0) + 1;
    });

    const sortedVersions = Object.entries(versionStats)
      .sort(([,a], [,b]) => b - a)
      .map(([version, count]) => ({ 
          version, 
        count
      }));

    console.log(`📝 WordPress-repositoryt: ${wordpressRepos.length} kpl`);
    console.log(`📊 Eri WordPress-versioita: ${sortedVersions.length} kpl`);

    res.render('wordpress', {
      title: 'WordPress - PHP-sivustot',
      organization: GITHUB_ORG,
      wordpressRepos: wordpressRepos,
      noWordPressRepos: noWordPressRepos,
      versionStats: sortedVersions,
      stats: {
        totalRepos: githubRepos.length,
        phpRepos: phpRepos.length,
        wordpressRepos: wordpressRepos.length,
        noWordPressRepos: noWordPressRepos.length,
        uniqueVersions: sortedVersions.length
      },
      getLanguageColor: getLanguageColor
    });

  } catch (error) {
    console.error('❌ Virhe WordPress-sivun latauksessa:', error);
    res.render('error', {
      message: 'Virhe WordPress-sivun latauksessa',
      error: { status: 500, stack: error.stack }
    });
  }
});

// Dependabot route - Security alerts page
/* Legacy dependabot removed - handled by new architecture
app.get('/dependabot', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }

    console.log('🛡️ Aloitetaan Dependabot-sivun lataus...');
    
    // Check if we should refresh data from API or use cached data
    const refreshData = req.query.refresh === 'true';
    let repositories;
    
    if (refreshData) {
      console.log('🔄 Päivitetään tiedot GitHub API:sta...');
      repositories = await getRecentRepositories();
      console.log(`📦 Repot haettu onnistuneesti: ${repositories.length} kpl`);
    } else {
      console.log('💾 Käytetään tietokantaan tallennettuja tietoja...');
      repositories = await cacheManager.getRepositories();
      console.log(`📦 Repot haettu tietokannasta: ${repositories.length} kpl`);
      
      // Jos tietokannassa ei ole tietoja, hae API:sta
      if (repositories.length === 0) {
        console.log('💾 Tietokanta tyhjä, haetaan tiedot API:sta...');
        repositories = await getRecentRepositories();
        console.log(`📦 Repot haettu API:sta: ${repositories.length} kpl`);
      }
    }
    
    // Apply repository limit for testing if set
    if (MAX_REPOSITORIES && MAX_REPOSITORIES > 0) {
      repositories = repositories.slice(0, MAX_REPOSITORIES);
      console.log(`🧪 TESTTILA: Rajoitettu ${MAX_REPOSITORIES} repositoryyn (alkuperäinen määrä: ${repositories.length})`);
    }
    
    console.log(`📦 GitHub repot haettu: ${repositories.length} kpl`);

    const reposWithAlerts = [];
    const reposWithoutAlerts = [];
    
    // Check if we have complete data in database
    const hasCompleteData = repositories.length > 0 && repositories.every(repo => 
      repo.dependabot_critical_count !== undefined
    );
    
    // Only fetch dependabot and owner data if refresh requested or data is missing
    const needToFetchData = refreshData || !hasCompleteData;
    
    console.log(`📊 Has complete data: ${hasCompleteData}, Need to fetch: ${needToFetchData}`);
    
    if (needToFetchData) {
      console.log('🔄 Haetaan Dependabot-tiedot API:sta...');
      const batchSize = 5; // Smaller batch for Dependabot due to API limits
      for (let i = 0; i < repositories.length; i += batchSize) {
        const batch = repositories.slice(i, i + batchSize);
        console.log(`📦 Käsitellään Dependabot-batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(repositories.length/batchSize)}`);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (repo) => {
            // Fetch both Dependabot and team data in parallel
            const [dependabotCount, teamData] = await Promise.all([
              getDependabotDataForRepo(repo),
              getTeamDataForRepo(repo)
            ]);
            console.log(`📦 Repository: ${repo.name} - Dependabot alerts: ${dependabotCount}, Teams: ${teamData.all_teams.length > 0 ? teamData.all_teams.join(', ') : 'none'}`);
            return { 
              ...repo, 
              dependabot_critical_count: dependabotCount,
              owner: teamData.owner || repo.owner,
              team: teamData.team || null,
              all_teams: teamData.all_teams || []
            };
          })
        );
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const repo = result.value;
            // Update the original repository in the array with new data (including teams)
            const originalIndex = i + index;
            if (originalIndex < repositories.length) {
              repositories[originalIndex] = repo;
            }
            if (repo.dependabot_critical_count > 0) {
              reposWithAlerts.push(repo);
            } else {
              reposWithoutAlerts.push(repo);
            }
          } else {
            reposWithoutAlerts.push(batch[index]);
          }
        });
        
        if (i + batchSize < repositories.length) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for Dependabot
        }
      }
      
      // Update database with new data (now includes team data)
      console.log('💾 Päivitetään tietokantaa uusilla tiedoilla...');
      for (const repo of repositories) {
        if (repo.all_teams && repo.all_teams.length > 0) {
          console.log(`💾 Tallennetaan repo ${repo.name} tiimeillä: ${repo.all_teams.join(', ')}`);
        }
        await cacheManager.saveRepository(repo);
      }
    } else {
      console.log('💾 Käytetään tallennettuja Dependabot ja owner-tietoja...');
      // Use cached data
      repositories.forEach(repo => {
        if (repo.dependabot_critical_count > 0) {
          reposWithAlerts.push(repo);
        } else {
          reposWithoutAlerts.push(repo);
        }
      });
    }

    const totalCriticalAlerts = reposWithAlerts.reduce((sum, repo) => sum + repo.dependabot_critical_count, 0);

    // Collect unique teams from all repositories
    const teamsSet = new Set();
    let reposWithTeams = 0;
    repositories.forEach(repo => {
      // Parse all_teams if it's a string (from database)
      let allTeams = repo.all_teams;
      if (typeof allTeams === 'string') {
        try {
          allTeams = JSON.parse(allTeams);
        } catch (e) {
          // If parsing fails, try as empty array
          allTeams = [];
        }
      }
      
      // Debug logging for first few repos
      if (reposWithTeams < 3 && (allTeams?.length > 0 || repo.team)) {
        console.log(`🔍 Debug repo ${repo.name}: all_teams type=${typeof repo.all_teams}, allTeams=${JSON.stringify(allTeams)}, team=${repo.team}`);
      }
      
      // Check all_teams array first (if it exists and is an array)
      if (allTeams && Array.isArray(allTeams) && allTeams.length > 0) {
        allTeams.forEach(team => {
          if (team && typeof team === 'string' && team.trim()) {
            teamsSet.add(team.trim());
          }
        });
        reposWithTeams++;
      }
      // Fallback to team field if all_teams is empty
      else if (repo.team && typeof repo.team === 'string' && repo.team.trim()) {
        teamsSet.add(repo.team.trim());
        reposWithTeams++;
      }
    });
    const teams = Array.from(teamsSet).sort();

    console.log(`🛡️ Repositoryt ilmoituksilla: ${reposWithAlerts.length} kpl`);
    console.log(`🛡️ Yhteensä kriittisiä ilmoituksia: ${totalCriticalAlerts} kpl`);
    console.log(`👥 Löydettiin ${teams.length} uniikkia tiimiä (${reposWithTeams}/${repositories.length} repossa on tiimi-tietoja)`);
    if (teams.length > 0) {
      console.log(`👥 Tiimit: ${teams.join(', ')}`);
    }
    console.log(`🔍 Debug: teams array type: ${Array.isArray(teams) ? 'Array' : typeof teams}, length: ${teams ? teams.length : 'N/A'}`);

    res.render('dependabot', {
      title: 'Dependabot - Turvallisuusilmoitukset',
      organization: GITHUB_ORG,
      reposWithAlerts: reposWithAlerts,
      reposWithoutAlerts: reposWithoutAlerts,
      teams: teams,
      stats: {
        totalRepos: repositories.length,
        reposWithAlerts: reposWithAlerts.length,
        reposWithoutAlerts: reposWithoutAlerts.length,
        totalCriticalAlerts: totalCriticalAlerts
      },
      getLanguageColor: getLanguageColor
    });

  } catch (error) {
    console.error('❌ Virhe Dependabot-sivun latauksessa:', error);
    res.render('error', {
      message: 'Virhe Dependabot-sivun latauksessa',
      error: { status: 500, stack: error.stack }
    });
  }
});*/

// Commits route - Moved to new architecture (routes/commits.js)
// Legacy route kept for backward compatibility
app.get('/commits-legacy', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }

    console.log('📝 Aloitetaan Commits-sivun lataus...');
    
    // Check if we should refresh data from API or use cached data
    const refreshData = req.query.refresh === 'true';
    let repositories;
    
    if (refreshData) {
      console.log('🔄 Päivitetään tiedot GitHub API:sta...');
      repositories = await getRecentRepositories();
      console.log(`📦 Repot haettu onnistuneesti: ${repositories.length} kpl`);
    } else {
      console.log('💾 Käytetään tietokantaan tallennettuja tietoja...');
      repositories = await cacheManager.getRepositories();
      console.log(`📦 Repot haettu tietokannasta: ${repositories.length} kpl`);
      
      // Jos tietokannassa ei ole tietoja, hae API:sta
      if (repositories.length === 0) {
        console.log('💾 Tietokanta tyhjä, haetaan tiedot API:sta...');
        repositories = await getRecentRepositories();
        console.log(`📦 Repot haettu API:sta: ${repositories.length} kpl`);
      }
    }
    
    // Apply repository limit for testing if set
    if (MAX_REPOSITORIES && MAX_REPOSITORIES > 0) {
      repositories = repositories.slice(0, MAX_REPOSITORIES);
      console.log(`🧪 TESTTILA: Rajoitettu ${MAX_REPOSITORIES} repositoryyn (alkuperäinen määrä: ${repositories.length})`);
    }
    
    // Suodata pois arkistoidut repositoryt
    const archivedCount = repositories.filter(repo => repo.archived).length;
    repositories = repositories.filter(repo => !repo.archived);
    console.log(`🗃️ Arkistoitu: ${archivedCount}, Aktiivinen: ${repositories.length}`);
    console.log(`📦 GitHub repot haettu: ${repositories.length} kpl`);
    
    // Hae viimeisimmät commitit kaikille repositoryille
    const reposWithCommits = [];
    const batchSize = 5;
    
    console.log('🔄 Haetaan viimeisimmät commitit...');
    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      console.log(`📦 Käsitellään Commits-batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(repositories.length/batchSize)}`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          const ownerLogin = getOwnerLogin(repo);
          const commitData = await getLatestCommitData(ownerLogin, repo.name);
          return { 
            ...repo,
            latest_commit: commitData
          };
        })
      );
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          reposWithCommits.push(result.value);
        }
      });
      
      // Small delay between batches
      if (i + batchSize < repositories.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Järjestä viimeisimmän commitin päivämäärän mukaan
    reposWithCommits.sort((a, b) => {
      const dateA = a.latest_commit?.date ? new Date(a.latest_commit.date) : new Date(0);
      const dateB = b.latest_commit?.date ? new Date(b.latest_commit.date) : new Date(0);
      return dateB - dateA; // Uusin ensin
    });
    
    console.log(`✅ Commits-sivu valmis: ${reposWithCommits.length} repositoryä`);

    res.render('commits', {
      title: 'Commits - Viimeisimmät commitit',
      organization: GITHUB_ORG,
      repositories: reposWithCommits,
      stats: {
        totalRepos: reposWithCommits.length,
        reposWithCommits: reposWithCommits.filter(r => r.latest_commit?.author).length,
        reposWithoutCommits: reposWithCommits.filter(r => !r.latest_commit?.author).length
      },
      getLanguageColor: getLanguageColor
    });

  } catch (error) {
    console.error('❌ Virhe Commits-sivun latauksessa:', error);
    res.render('error', {
      message: 'Virhe Commits-sivun latauksessa',
      error: { status: 500, stack: error.stack }
    });
  }
});

// HDS route - Helsinki Design System page
/* Legacy hds removed - handled by new architecture
app.get('/hds', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }

    console.log('🎨 Aloitetaan HDS-sivun lataus...');

    // Get all repositories
    const githubRepos = await getRecentRepositories();
    console.log(`📦 GitHub repot haettu: ${githubRepos.length} kpl`);

    // Filter repositories that have package.json (likely frontend projects)
    const frontendRepos = githubRepos.filter(repo => 
      repo.language === 'JavaScript' || 
      repo.language === 'TypeScript' || 
      repo.language === 'HTML' ||
      repo.language === 'CSS' ||
      repo.language === 'SCSS' ||
      repo.language === 'Vue' ||
      repo.language === 'React'
    );

    console.log(`🎨 Frontend-repositoryt: ${frontendRepos.length} kpl`);

    // Process HDS data in batches
    const batchSize = 10;
    const hdsRepos = [];
    
    for (let i = 0; i < frontendRepos.length; i += batchSize) {
      const batch = frontendRepos.slice(i, i + batchSize);
      console.log(`📦 Käsitellään HDS-batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(frontendRepos.length/batchSize)}`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          const hdsData = await getHDSDataForRepo(repo);
          if (hdsData && hdsData.has_hds) {
            return { ...repo, hds_data: hdsData };
          }
          return null;
        })
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          hdsRepos.push(result.value);
        }
      });
      
      // Small delay between batches
      if (i + batchSize < frontendRepos.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`🎨 HDS-repositoryt: ${hdsRepos.length} kpl`);

    // Analyze HDS versions
    const versionStats = {};
    const packageStats = {};
    
    hdsRepos.forEach(repo => {
      Object.entries(repo.hds_data.hds_packages).forEach(([packageName, version]) => {
        versionStats[version] = (versionStats[version] || 0) + 1;
        packageStats[packageName] = (packageStats[packageName] || 0) + 1;
      });
    });

    const sortedVersions = Object.entries(versionStats)
      .sort(([,a], [,b]) => b - a)
      .map(([version, count]) => ({ version, count }));

    const sortedPackages = Object.entries(packageStats)
      .sort(([,a], [,b]) => b - a)
      .map(([packageName, count]) => ({ packageName, count }));

    console.log(`📊 Eri HDS-versioita: ${sortedVersions.length} kpl`);
    console.log(`📦 Eri HDS-paketteja: ${sortedPackages.length} kpl`);

    res.render('hds', {
      title: 'HDS - Helsinki Design System',
      organization: GITHUB_ORG,
      hdsRepos: hdsRepos,
      stats: {
        totalRepos: githubRepos.length,
        frontendRepos: frontendRepos.length,
        hdsRepos: hdsRepos.length,
        totalVersions: sortedVersions.length,
        totalPackages: sortedPackages.length
      },
      versionStats: sortedVersions,
      packageStats: sortedPackages,
      getLanguageColor: getLanguageColor
    });

  } catch (error) {
    console.error('❌ Virhe HDS-sivun latauksessa:', error);
    res.render('error', {
      message: 'Virhe HDS-sivun latauksessa',
      error: { status: 500, stack: error.stack }
    });
  }
});*/

// Dockerfile route - Docker information page
app.get('/dockerfile', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }

    console.log('🐳 Aloitetaan Dockerfile-sivun lataus...');
    
    // Get all repositories
    const githubRepos = await getRecentRepositories();
    console.log(`📦 GitHub repot haettu: ${githubRepos.length} kpl`);
    
    // Check if we should refresh data from API or use cached data
    const refreshData = req.query.refresh === 'true';

    console.log(`🔍 Aloitetaan Docker-tietojen haku ${githubRepos.length} repositorylle...`);
    
  // Fetch Dockerfile presence for all repositories (lightweight)
  console.log(`🐳 Haetaan Dockerfile-tiedosto (jos löytyy) ${githubRepos.length} repositorylle...`);
    const dockerRepos = [];
    const noDockerRepos = [];
    
    // Process repositories in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < githubRepos.length; i += batchSize) {
      const batch = githubRepos.slice(i, i + batchSize);
      console.log(`📦 Käsitellään Docker-batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(githubRepos.length/batchSize)} (${batch.length} reposta)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          console.log(`🔄 Käsitellään repo: ${repo.name}`);
          const single = await getSingleDockerfileForRepo(repo);
          if (single) {
            const primaryBaseImage = single.baseImages && single.baseImages.length > 0 ? single.baseImages[0].image : null;
            console.log(`📊 Dockerfile löytyi (${single.path}) reposta ${repo.name}${primaryBaseImage ? `, base image: ${primaryBaseImage}` : ''}`);
          return {
            ...repo,
              docker_data: { dockerfiles: [single.path] },
              docker_base_image: primaryBaseImage
          };
          }
          console.log(`❌ Ei Dockerfileä: ${repo.name}`);
          return { ...repo, docker_data: null, docker_base_image: null };
        })
      );
      
      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const repo = result.value;
          if (repo.docker_base_image || (repo.docker_data && repo.docker_data.dockerfiles && repo.docker_data.dockerfiles.length > 0)) {
            dockerRepos.push(repo);
            console.log(`✅ Dockerfile löydetty: ${repo.name}`);
          } else {
            noDockerRepos.push(repo);
            console.log(`❌ Ei Dockerfileä: ${repo.name}`);
          }
        } else {
          console.error(`❌ Docker-tietojen haku epäonnistui reposta ${batch[index].name}:`, result.reason);
          noDockerRepos.push(batch[index]);
        }
      });
      
      console.log(`📊 Batch ${Math.floor(i/batchSize) + 1} valmis. Docker-repoja: ${dockerRepos.length}, Ei Dockerfileä: ${noDockerRepos.length}`);
      
      // Small delay between batches to be respectful to the API
      if (i + batchSize < githubRepos.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Analyze Docker base images (from primary Dockerfile only)
    const baseImageStats = {};
    dockerRepos.forEach(repo => {
      const baseImage = repo.docker_base_image || 'unknown';
      baseImageStats[baseImage] = (baseImageStats[baseImage] || 0) + 1;
    });

    // Sort by usage count
    const sortedBaseImages = Object.entries(baseImageStats)
      .sort(([,a], [,b]) => b - a)
      .map(([image, count]) => ({ 
        image, 
        count
      }));

    console.log(`🐳 Docker-repositoryt: ${dockerRepos.length} kpl`);
    console.log(`📊 Eri base image -tyyppejä: ${sortedBaseImages.length} kpl`);

    res.render('dockerfile', {
      title: 'Dockerfile - Docker Repositoryt',
      organization: GITHUB_ORG,
      dockerRepos: dockerRepos,
      noDockerRepos: noDockerRepos,
      baseImageStats: sortedBaseImages,
      stats: {
        totalRepos: githubRepos.length,
        dockerRepos: dockerRepos.length,
        noDockerRepos: noDockerRepos.length,
        uniqueBaseImages: sortedBaseImages.length
      },
      getLanguageColor: getLanguageColor
    });

  } catch (error) {
    console.error('❌ Virhe Dockerfile-sivun latauksessa:', error);
    res.render('error', {
      message: 'Virhe Dockerfile-sivun latauksessa',
      error: { status: 500, stack: error.stack }
    });
  }
});

// API reitti repojen hakuun
// /api/repos route moved to new architecture (routes/repositories.js)

// Rate limit status endpoint
app.get('/api/rate-limit', (req, res) => {
  const status = rateLimiter.getRateLimitStatus();
  res.json({
    ...status,
    resetTime: new Date(status.reset).toISOString(),
    percentageUsed: Math.round((status.used / status.limit) * 100),
    isNearLimit: status.remaining < 100,
    isAtLimit: status.remaining <= 0
  });
});

// Cache status endpoint
app.get('/api/cache', async (req, res) => {
  try {
    const stats = dependencies.cacheManager.getStats();
    const info = await dependencies.cacheManager.getInfo();
    const cacheRepoStats = await dependencies.cacheRepository.getStats();
    
  res.json({
    ...stats,
      info: info,
      repository: cacheRepoStats,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptime: process.uptime()
  });
  } catch (error) {
    res.status(500).json({ error: 'Cache stats error', message: error.message });
  }
});

// Note: New architecture routes are registered in initializeDependencies() callback
// They are registered after dependencies are initialized to avoid null reference errors
// See line ~909-914 for route registration

// Legacy routes (kept for backward compatibility during migration)
// Note: /commits, /teams, /collaborators, /issues, and /pull-requests routes are now handled by new architecture

/* Legacy users removed - handled by new architecture
app.get('/users', async (req, res) => {
  try {
    const org = req.query.org || GITHUB_ORG;
    const members = await githubClient.getAllPages(`/orgs/${org}/members`, { perPage: 100, maxPages: 5 });
    res.render('users', { title: 'Users', users: members });
  } catch (err) {
    req.logger?.error('view.users.error', { message: err.message });
    res.render('users', { title: 'Users', users: [] });
  }
});*/

/* Legacy languages removed - handled by new architecture
app.get('/languages', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }
    
    // Check if we should refresh data from API or use cached data
    const refreshData = req.query.refresh === 'true';
    let repositories;
    
    if (refreshData) {
      try {
        repositories = await getRecentRepositories();
      } catch (error) {
        console.error('❌ Virhe repojen haussa:', error.message);
        repositories = [];
      }
    } else {
      try {
        repositories = await cacheManager.getRepositories();
        
        // Jos tietokannassa ei ole tietoja, hae API:sta
        if (repositories.length === 0) {
          try {
            repositories = await getRecentRepositories();
          } catch (error) {
            console.error('❌ Virhe repojen haussa:', error.message);
            repositories = [];
          }
        }
      } catch (dbError) {
        console.error('❌ Virhe tietokantaan tallennettujen tietojen haussa:', dbError.message);
        repositories = [];
      }
    }
    
    // Laske yhteenvedot nopeasti - yksinkertaistettu logiikka
    const languageCounts = { PHP: 0, JavaScript: 0, Python: 0, Java: 0 };
    const frameworkCounts = { React: 0, Django: 0, Drupal: 0, WordPress: 0 };
    
    for (const repo of repositories) {
      const lang = repo.language;
      const repoName = repo.name.toLowerCase();
      
      // Kieli-yhteenvedot - vain tärkeimmät tarkistukset
      if (lang === 'PHP') languageCounts.PHP++;
      else if (lang === 'JavaScript' || lang === 'TypeScript') languageCounts.JavaScript++;
      else if (lang === 'Python') languageCounts.Python++;
      else if (lang === 'Java') languageCounts.Java++;
      
      // Framework-yhteenvedot - vain olemassa olevat versiot tai selkeät nimet
      if (repo.react_version || repoName.includes('react')) frameworkCounts.React++;
      if (repo.django_version || repoName.includes('django')) frameworkCounts.Django++;
      if (repo.drupal_version || repoName.includes('drupal')) frameworkCounts.Drupal++;
      if (repoName.includes('wordpress') || repoName.includes('wp')) frameworkCounts.WordPress++;
    }
    
    res.render('languages', {
      title: 'Languages',
      organization: GITHUB_ORG,
      repositories: repositories,
      totalRepos: repositories.length,
      languageCounts: languageCounts,
      frameworkCounts: frameworkCounts,
      getLanguageColor: getLanguageColor
    });
  } catch (error) {
    console.error('Virhe sivun latauksessa:', error);
    
    // Jos on 502-virhe, näytä ystävällisempi viesti
    if (error.response?.status === 502) {
      res.render('error', {
        message: 'GitHub API on väliaikaisesti poissa käytöstä (502 Bad Gateway). Yritä myöhemmin uudelleen.',
        error: { status: 502 }
      });
    } else {
      res.render('error', {
        message: 'Virhe repojen latauksessa',
        error: { status: 500, stack: error.stack }
      });
    }
  }
});*/

// Commits route - Moved to new architecture (routes/commits.js)
// Legacy route removed - handled by new architecture

// Teams route - Moved to new architecture (routes/teams.js)
// Legacy route removed - handled by new architecture

// Collaborators route - Moved to new architecture (routes/collaborators.js)
// Legacy route removed - handled by new architecture

/* Legacy branches removed - handled by new architecture
app.get('/branches', (req, res) => {
  // Fetch branches for each repository in the organization
  (async () => {
    try {
      const org = req.query.org || GITHUB_ORG;
      const repos = await githubClient.getAllPages(`/orgs/${org}/repos`, { perPage: 100, maxPages: 2 });
      const results = [];
      for (const r of repos) {
        try {
          const branches = await githubClient.getAllPages(`/repos/${r.owner.login}/${r.name}/branches`, { perPage: 100, maxPages: 1 });
          results.push({
            repo: r.name,
            fullName: r.full_name,
            defaultBranch: r.default_branch,
            branchCount: branches.length,
            branches: branches.map(b => ({ name: b.name, protected: !!b.protected })),
            htmlUrl: r.html_url
          });
        } catch (e) {
          req.logger?.warn('branches.fetch.failed', { repo: r.full_name, message: e.message });
        }
      }
      res.render('branches', { title: 'Branches', repos: results });
    } catch (err) {
      req.logger?.error('view.branches.error', { message: err.message });
      res.render('branches', { title: 'Branches', repos: [] });
    }
  })();
});*/

/* Legacy contents removed - handled by new architecture
app.get('/contents', (req, res) => {
  // Top-level contents analysis for each repo
  (async () => {
    try {
      const org = req.query.org || GITHUB_ORG;
      const repos = await githubClient.getAllPages(`/orgs/${org}/repos`, { perPage: 100, maxPages: 2 });
      const results = [];
      for (const r of repos) {
        try {
          const { data } = await githubClient.request('GET', `/repos/${r.owner.login}/${r.name}/contents`, {});
          const items = Array.isArray(data) ? data : [];
          const summary = {
            hasReadme: items.some(i => /README\.md/i.test(i.name)),
            hasLicense: items.some(i => /LICENSE/i.test(i.name)),
            hasDockerfile: items.some(i => i.name === 'Dockerfile'),
            hasPackageJson: items.some(i => i.name === 'package.json'),
            hasRequirementsTxt: items.some(i => i.name === 'requirements.txt'),
            workflows: items.some(i => i.name === '.github'),
            dirs: items.filter(i => i.type === 'dir').length,
            files: items.filter(i => i.type === 'file').length,
          };
          results.push({
            repo: r.name,
            fullName: r.full_name,
            htmlUrl: r.html_url,
            defaultBranch: r.default_branch,
            summary,
            items: items.slice(0, 50).map(i => ({ name: i.name, type: i.type, path: i.path, html_url: i.html_url }))
          });
        } catch (e) {
          req.logger?.warn('contents.fetch.failed', { repo: r.full_name, message: e.message });
        }
      }
      res.render('contents', { title: 'Contents', repos: results });
    } catch (err) {
      req.logger?.error('view.contents.error', { message: err.message });
      res.render('contents', { title: 'Contents', repos: [] });
    }
  })();
});*/

/* Legacy releases removed - handled by new architecture
app.get('/releases', async (req, res) => {
  try {
    const org = req.query.org || GITHUB_ORG;
    const repos = await githubClient.getAllPages(`/orgs/${org}/repos`, { perPage: 100, maxPages: 2 });
    const all = [];
    for (const r of repos) {
      try {
        const releases = await githubClient.request('GET', `/repos/${r.owner.login}/${r.name}/releases`, { params: { per_page: 5 } });
        (releases.data || []).forEach(x => all.push({ repo: r.name, ...x }));
      } catch (_) { // ignore repos without releases
      }
    }
    res.render('releases', { title: 'Releases', releases: all });
  } catch (err) {
    req.logger?.error('view.releases.error', { message: err.message });
    res.render('releases', { title: 'Releases', releases: [] });
  }
});*/

// Pull Requests route - Moved to new architecture (routes/pullRequests.js)
// Legacy route removed - handled by new architecture

// Issues route - Moved to new architecture (routes/issues.js)
// Legacy route removed - handled by new architecture

app.get('/code-scanning', async (req, res) => {
  const org = req.query.org || GITHUB_ORG;
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const perPage = Math.min(Math.max(parseInt(req.query.per_page || '50', 10), 1), 100);
  const filters = {
    state: req.query.state || '',
    severity: req.query.severity || '',
    tool: req.query.tool || '',
    repo: req.query.repo || '',
    q: req.query.q || ''
  };

  function toParamsForApi() {
    const p = { page, per_page: perPage };
    if (filters.state) p.state = filters.state; // open | closed
    if (filters.severity) p.severity = filters.severity; // critical|high|medium|low
    if (filters.tool) p.tool_name = filters.tool;
    return p;
  }

  try {
    let items = [];
    let total = 0;
    let summary = { total: 0, open: 0, dismissed: 0, critical: 0, high: 0, medium: 0, low: 0 };
    let fallbackUsed = false;

    // Prefer org endpoint
    try {
      // Simple in-memory cache per filter set
      const cacheKey = `codescan:${org}:${JSON.stringify({ p: toParamsForApi(), repo: filters.repo, q: filters.q })}`;
      const cached = require('./src/integrations/cache/memoryCache').defaultCache.get(cacheKey);
      if (cached) {
        items = cached.items;
        total = cached.total;
      } else {
        const resp = await githubClient.request('GET', `/orgs/${org}/code-scanning/alerts`, { params: toParamsForApi() });
        items = Array.isArray(resp.data) ? resp.data : [];
        total = items.length + (page - 1) * perPage;
        require('./src/integrations/cache/memoryCache').defaultCache.set(cacheKey, { items, total }, 600000);
      }
    } catch (e) {
      // Fallback: per-repo aggregation for this page
      fallbackUsed = true;
      const repos = await githubClient.getAllPages(`/orgs/${org}/repos`, { params: { type: 'all' }, perPage: 100, maxPages: 1 });
      for (const r of repos) {
        if (filters.repo && r.full_name !== filters.repo) continue;
        try {
          const params = toParamsForApi();
          const cacheKeyRepo = `codescan_repo:${r.full_name}:${JSON.stringify(params)}`;
          const cacheLayer = require('./src/integrations/cache/memoryCache').defaultCache;
          const c = cacheLayer.get(cacheKeyRepo);
          if (c) {
            items.push(...c);
          } else {
            const rresp = await githubClient.request('GET', `/repos/${r.owner.login}/${r.name}/code-scanning/alerts`, { params });
            const arr = Array.isArray(rresp.data) ? rresp.data : [];
            cacheLayer.set(cacheKeyRepo, arr, 300000);
            items.push(...arr);
          }
          if (items.length >= perPage) break;
        } catch (_er) {}
      }
      total = items.length;
    }

    // Map and filter client-side text search
    const normQ = (filters.q || '').toLowerCase();
    const mapped = items.map(a => {
      const repoFullName = a.repository?.full_name || a.repository?.name || a.repository?.html_url?.split('/').slice(-2).join('/') || '';
      const repoHtmlUrl = a.repository?.html_url || (a.html_url ? a.html_url.split('/security-code-scanning')[0] : '');
      return {
        repoFullName,
        repoHtmlUrl,
        ruleId: a.rule?.id || a.rule_id || '',
        ruleDescription: a.rule?.description || a.rule?.name || '',
        severity: a.rule?.severity || a.severity || '',
        state: a.state,
        createdAt: a.created_at || a.most_recent_instance?.created_at,
        updatedAt: a.updated_at || a.most_recent_instance?.updated_at,
        htmlUrl: a.html_url
      };
    }).filter(a => {
      if (!normQ) return true;
      const txt = `${a.repoFullName} ${a.ruleId} ${a.ruleDescription}`.toLowerCase();
      return txt.includes(normQ);
    });

    // Summary from current page
    for (const a of mapped) {
      summary.total += 1;
      if (a.state === 'open') summary.open += 1; else summary.dismissed += 1;
      if (a.severity === 'critical') summary.critical += 1;
      else if (a.severity === 'high') summary.high += 1;
      else if (a.severity === 'medium') summary.medium += 1;
      else if (a.severity === 'low') summary.low += 1;
    }

    const totalPages = Math.max(1, Math.ceil((total || summary.total) / perPage));

    req.logger?.info('codescan.view.debug', {
      org,
      filters,
      page,
      perPage,
      returned: mapped.length,
      summary,
      fallbackUsed
    });

    res.render('code_scanning', {
      title: 'Code Scanning',
      alerts: mapped.slice(0, perPage),
      filters,
      page,
      perPage,
      total: total || summary.total,
      totalPages,
      summary,
      fallbackUsed
    });
  } catch (err) {
    req.logger?.error('view.code_scanning.error', { message: err.message });
    res.render('code_scanning', { title: 'Code Scanning', alerts: [], filters: {}, page: 1, perPage: 50, total: 0, totalPages: 1, summary: { total: 0, open: 0, dismissed: 0, critical: 0, high: 0, medium: 0, low: 0 }, fallbackUsed: false });
  }
});

app.get('/licenses', async (req, res) => {
  try {
    const org = req.query.org || GITHUB_ORG;
    const includeArchived = req.query.include_archived === 'true';
    const repos = await githubClient.getAllPages(`/orgs/${org}/repos`, { perPage: 100, maxPages: 10 });
    const filtered = includeArchived ? repos : repos.filter(r => !r.archived);
    const fetchedTotal = repos.length;
    const archivedSkipped = includeArchived ? 0 : repos.filter(r => r.archived).length;
    const analyzedPublic = filtered.filter(r => !r.private).length;
    const analyzedPrivate = filtered.filter(r => r.private).length;
    const fetchedPublic = repos.filter(r => !r.private).length;
    const fetchedPrivate = repos.filter(r => r.private).length;
    const fetchedForks = repos.filter(r => r.fork).length;
    const fetchedArchived = repos.filter(r => r.archived).length;

    req.logger?.info('licenses.fetch.debug', {
      fetchedTotal,
      fetchedPublic,
      fetchedPrivate,
      fetchedForks,
      fetchedArchived,
      includeArchived,
      analyzedTotal: filtered.length,
      analyzedPublic,
      analyzedPrivate,
      archivedSkipped
    });

    const countsBySpdx = new Map();
    let withSpdx = 0;

    const data = [];
    for (const r of filtered) {
      let licenseName = r.license?.name || null;
      let rawSpdx = r.license?.spdx_id || null;
      let spdx = rawSpdx && rawSpdx !== 'NOASSERTION' ? rawSpdx : null;

      // Try to fetch detailed license if missing SPDX from metadata
      if (!spdx) {
        try {
          const resp = await githubClient.request('GET', `/repos/${r.owner.login}/${r.name}/license`);
          const lic = resp.data?.license;
          if (lic) {
            if (!licenseName) licenseName = lic.name || licenseName;
            if (lic.spdx_id && lic.spdx_id !== 'NOASSERTION') spdx = lic.spdx_id;
          }
        } catch (_e) {
          // Ignore not found or no license
        }
      }

      const licenseLink = `${r.html_url}/blob/${r.default_branch || 'main'}/LICENSE`;
      if (spdx) {
        withSpdx += 1;
        countsBySpdx.set(spdx, (countsBySpdx.get(spdx) || 0) + 1);
      }

      data.push({
        fullName: r.full_name,
        repoUrl: r.html_url,
        licenseName,
        spdx,
        licenseLink: licenseName ? licenseLink : null
      });
    }
    const total = filtered.length;
    const unknown = total - withSpdx;
    const breakdown = Array.from(countsBySpdx.entries())
      .map(([spdx, count]) => ({ spdx, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    res.render('licenses', {
      title: 'Licenses',
      licenses: data,
      includeArchived,
      summary: { total, withSpdx, unknown, breakdown, fetchedTotal, archivedSkipped, analyzedPublic, analyzedPrivate }
    });
  } catch (err) {
    req.logger?.error('view.licenses.error', { message: err.message });
    res.render('licenses', { title: 'Licenses', licenses: [], includeArchived: false, summary: { total: 0, withSpdx: 0, unknown: 0, breakdown: [], fetchedTotal: 0, archivedSkipped: 0, analyzedPublic: 0, analyzedPrivate: 0 } });
  }
});

// Example endpoint using new GitHub client with retry + ETag cache + pagination
app.get('/api/github/org-repos', async (req, res) => {
  try {
    const org = req.query.org || GITHUB_ORG;
    const perPage = req.query.per_page ? parseInt(req.query.per_page) : 100;
    const maxPages = req.query.max_pages ? parseInt(req.query.max_pages) : 1;
    const repos = await githubClient.getAllPages(`/orgs/${org}/repos`, { perPage, maxPages });
    res.json(repos);
  } catch (err) {
    req.logger?.error('github.client.error', { message: err.message, status: err.status, code: err.code });
    res.status(err.status || 500).json({ error: err.message || 'GitHub error' });
  }
});

// Clear cache endpoint
app.post('/api/cache/clear', async (req, res) => {
  try {
    await dependencies.cacheManager.clearAll();
  res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Cache clear error', message: error.message });
  }
});

// Invalidate cache for specific repository
app.post('/api/cache/invalidate/:repoName', async (req, res) => {
  try {
    const { repoName } = req.params;
    await dependencies.cacheManager.invalidateRepo(repoName);
    res.json({ message: `Cache invalidated for repository: ${repoName}` });
  } catch (error) {
    res.status(500).json({ error: 'Cache invalidation error', message: error.message });
  }
});

// Cache cleanup endpoint
app.post('/api/cache/cleanup', async (req, res) => {
  try {
    await dependencies.cacheManager.cleanExpired();
    res.json({ message: 'Expired cache entries cleaned successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Cache cleanup error', message: error.message });
  }
});

// Legacy endpoint - use invalidate instead
app.post('/api/cache/clear/:repoName', async (req, res) => {
  try {
  const { repoName } = req.params;
    await dependencies.cacheManager.invalidateRepo(repoName);
  res.json({ message: `Cache cleared for repository: ${repoName}` });
  } catch (error) {
    res.status(500).json({ error: 'Cache clear error', message: error.message });
  }
});

// Database endpoints
app.get('/api/db/repos', async (req, res) => {
  try {
    const repositories = await cacheManager.getRepositories();
    res.json(repositories);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/db/stats', async (req, res) => {
  try {
    const cacheStats = await cacheManager.getStats();
    res.json({
      cache: cacheStats,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Rate limit control endpoints
app.get('/api/rate-limit/status', (req, res) => {
  res.json({
    enabled: rateLimiter.enabled,
    debug: rateLimiter.debug,
    status: rateLimiter.getRateLimitStatus()
  });
});

// Code scanning JSON API
app.get('/api/code-scanning/alerts', async (req, res) => {
  const org = req.query.org || GITHUB_ORG;
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const perPage = Math.min(Math.max(parseInt(req.query.per_page || '50', 10), 1), 100);
  const filters = {
    state: req.query.state || '',
    severity: req.query.severity || '',
    tool: req.query.tool || '',
    repo: req.query.repo || '',
    q: req.query.q || ''
  };
  function toParamsForApi() {
    const p = { page, per_page: perPage };
    if (filters.state) p.state = filters.state;
    if (filters.severity) p.severity = filters.severity;
    if (filters.tool) p.tool_name = filters.tool;
    return p;
  }

  try {
    let items = [];
    let total = 0;
    let fallbackUsed = false;
    try {
      const resp = await githubClient.request('GET', `/orgs/${org}/code-scanning/alerts`, { params: toParamsForApi() });
      items = Array.isArray(resp.data) ? resp.data : [];
      total = items.length + (page - 1) * perPage;
    } catch (e) {
      fallbackUsed = true;
      const repos = await githubClient.getAllPages(`/orgs/${org}/repos`, { params: { type: 'all' }, perPage: 100, maxPages: 1 });
      for (const r of repos) {
        if (filters.repo && r.full_name !== filters.repo) continue;
        try {
          const params = toParamsForApi();
          const rresp = await githubClient.request('GET', `/repos/${r.owner.login}/${r.name}/code-scanning/alerts`, { params });
          const arr = Array.isArray(rresp.data) ? rresp.data : [];
          items.push(...arr);
          if (items.length >= perPage) break;
        } catch (_er) {}
      }
      total = items.length;
    }
    const normQ = (filters.q || '').toLowerCase();
    const mapped = items.map(a => ({
      repository: a.repository?.full_name || a.repository?.name || '',
      rule_id: a.rule?.id || a.rule_id || '',
      rule_description: a.rule?.description || a.rule?.name || '',
      severity: a.rule?.severity || a.severity || '',
      state: a.state,
      created_at: a.created_at || a.most_recent_instance?.created_at,
      updated_at: a.updated_at || a.most_recent_instance?.updated_at,
      html_url: a.html_url
    })).filter(a => !normQ || `${a.repository} ${a.rule_id} ${a.rule_description}`.toLowerCase().includes(normQ));
    res.json({ items: mapped.slice(0, perPage), total: total || mapped.length, page, per_page: perPage, fallbackUsed });
  } catch (err) {
    res.status(500).json({ error: 'Code scanning fetch failed', message: err.message });
  }
});

// Code scanning CSV export
app.get('/api/code-scanning/export.csv', async (req, res) => {
  const org = req.query.org || GITHUB_ORG;
  const filters = {
    state: req.query.state || '',
    severity: req.query.severity || '',
    tool: req.query.tool || '',
    repo: req.query.repo || '',
    q: req.query.q || ''
  };
  function toParamsForApi(page) {
    const p = { page, per_page: 100 };
    if (filters.state) p.state = filters.state;
    if (filters.severity) p.severity = filters.severity;
    if (filters.tool) p.tool_name = filters.tool;
    return p;
  }
  try {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="codescan-${org}.csv"`);
    res.write('repository,rule_id,severity,state,created_at,updated_at,html_url\n');

    let page = 1;
    while (true) {
      let items = [];
      try {
        const resp = await githubClient.request('GET', `/orgs/${org}/code-scanning/alerts`, { params: toParamsForApi(page) });
        items = Array.isArray(resp.data) ? resp.data : [];
      } catch (e) {
        // fallback: stop export on org endpoint error to avoid very long exports
        break;
      }
      if (items.length === 0) break;
      const normQ = (filters.q || '').toLowerCase();
      for (const a of items) {
        const repository = a.repository?.full_name || a.repository?.name || '';
        if (filters.repo && repository !== filters.repo) continue;
        const rule_id = (a.rule?.id || a.rule_id || '').toString().replaceAll('"', '');
        const severity = (a.rule?.severity || a.severity || '').toString();
        const state = (a.state || '').toString();
        const created_at = (a.created_at || a.most_recent_instance?.created_at || '').toString();
        const updated_at = (a.updated_at || a.most_recent_instance?.updated_at || '').toString();
        const html_url = (a.html_url || '').toString();
        const line = `${repository},${rule_id},${severity},${state},${created_at},${updated_at},${html_url}\n`;
        if (!normQ || line.toLowerCase().includes(normQ)) res.write(line);
      }
      page += 1;
    }
    res.end();
  } catch (err) {
    res.status(500).end('error');
  }
});

app.post('/api/rate-limit/toggle', (req, res) => {
  rateLimiter.enabled = !rateLimiter.enabled;
  console.log(`🔄 Rate limiting ${rateLimiter.enabled ? 'ENABLED' : 'DISABLED'}`);
  res.json({ 
    enabled: rateLimiter.enabled,
    message: `Rate limiting ${rateLimiter.enabled ? 'enabled' : 'disabled'}`
  });
});

app.post('/api/rate-limit/debug/toggle', (req, res) => {
  rateLimiter.debug = !rateLimiter.debug;
  console.log(`🔄 Rate limit debug ${rateLimiter.debug ? 'ENABLED' : 'DISABLED'}`);
  res.json({ 
    debug: rateLimiter.debug,
    message: `Rate limit debug ${rateLimiter.debug ? 'enabled' : 'disabled'}`
  });
});

// 404 handler - moved to after route registration
// This will be registered in the dependencies initialization callback

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    message: 'Sisäinen palvelinvirhe',
    error: { status: 500, stack: err.stack }
  });
});

// Global error handler should be registered last
app.use(errorHandler());

// Server startup is now handled in the dependencies initialization callback
// See line ~910-928 for the actual app.listen() call
