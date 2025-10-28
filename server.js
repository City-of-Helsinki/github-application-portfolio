const express = require('express');
const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

// Load Django EOL data
let djangoEOLData = {};
try {
  const eolData = fs.readFileSync(path.join(__dirname, 'django-eol.json'), 'utf8');
  djangoEOLData = JSON.parse(eolData);
} catch (error) {
  console.error('❌ Virhe Django EOL-tietojen latauksessa:', error.message);
}

// Load Docker EOL data
let dockerEOLData = {};
try {
  const dockerEOLFile = fs.readFileSync(path.join(__dirname, 'docker-eol.json'), 'utf8');
  dockerEOLData = JSON.parse(dockerEOLFile);
  console.log('✅ Docker EOL-tiedot ladattu');
} catch (error) {
  console.error('❌ Virhe Docker EOL-tietojen latauksessa:', error.message);
}

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

// Helper funktio kielten värien hakemiseen
function getLanguageColor(language) {
  return languageColors[language] || '#6c757d';
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// GitHub API konfiguraatio
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ORG = process.env.GITHUB_ORG || 'City-of-Helsinki';

// Rate limiting configuration
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';
const RATE_LIMIT_DEBUG = process.env.RATE_LIMIT_DEBUG === 'true';

// GitHub API headers
const githubHeaders = {
  'Authorization': `token ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'Application-Portfolio'
};

// Debug GitHub API access
console.log('🔑 GitHub API konfiguraatio:');
console.log(`   - Token: ${GITHUB_TOKEN ? 'Asetettu' : 'PUUTTUU'}`);
console.log(`   - Organisaatio: ${GITHUB_ORG}`);
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
const db = new sqlite3.Database('./portfolio.db');

// Initialize database tables
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
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Create indexes for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_cache_key ON cache(key)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_repos_name ON repositories(name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_repos_updated ON repositories(updated_at)`);
});

// Database-based cache system
class DatabaseCacheManager {
  constructor() {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      totalRequests: 0
    };
    this.pendingRequests = new Map(); // For request deduplication
  }

  // Generate cache key for repository data
  getCacheKey(repoName, dataType) {
    return `${repoName}:${dataType}`;
  }

  // Get data from database cache
  get(key) {
    return new Promise((resolve) => {
      this.cacheStats.totalRequests++;
      
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

  // Set data in database cache
  set(key, data, ttl = 3600000) { // Default 1 hour
    return new Promise((resolve) => {
      this.cacheStats.sets++;
      const expiresAt = new Date(Date.now() + ttl).toISOString();
      const dataString = JSON.stringify(data);
      
      db.run(
        'INSERT OR REPLACE INTO cache (key, data, expires_at) VALUES (?, ?, ?)',
        [key, dataString, expiresAt],
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

  // Save repository data to database
  saveRepository(repo) {
    return new Promise((resolve) => {
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
        dependabot_critical_count: repo.dependabot_critical_count
      };

      db.run(
        `INSERT OR REPLACE INTO repositories (
          name, full_name, description, html_url, clone_url, homepage,
          language, languages, stargazers_count, forks_count, updated_at,
          created_at, topics, readme, docker_base_image, django_version,
          react_version, drupal_version, dependabot_critical_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  // Get all repositories from database
  getRepositories() {
    return new Promise((resolve) => {
      db.all('SELECT * FROM repositories ORDER BY updated_at DESC', (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          resolve([]);
          return;
        }
        
        const repositories = rows.map(row => ({
          ...row,
          languages: JSON.parse(row.languages || '{}'),
          topics: JSON.parse(row.topics || '[]')
        }));
        
        resolve(repositories);
      });
    });
  }
}

const cacheManager = new DatabaseCacheManager();

// Clean expired cache entries every 30 minutes
setInterval(() => {
  cacheManager.cleanExpired();
}, 30 * 60 * 1000);

// Tarkista Docker base image EOL-tilassa
function checkDockerEOL(baseImage) {
  if (!baseImage) {
    return {
      status: 'unknown',
      eol_date: null,
      description: 'Tuntematon base image'
    };
  }

  // Normalize base image name (remove tags, digests, etc.)
  let normalizedImage = baseImage.toLowerCase();
  
  // Remove common prefixes and suffixes
  normalizedImage = normalizedImage.replace(/@sha256:[a-f0-9]+$/, ''); // Remove digest
  normalizedImage = normalizedImage.replace(/:[^:]+$/, ''); // Remove tag
  
  // Check for exact match first
  if (dockerEOLData[normalizedImage]) {
    return dockerEOLData[normalizedImage];
  }
  
  // Check for partial matches (e.g., node:18-alpine matches node:18)
  for (const [imagePattern, eolInfo] of Object.entries(dockerEOLData)) {
    if (normalizedImage.startsWith(imagePattern) || imagePattern.includes(normalizedImage)) {
      return eolInfo;
    }
  }
  
  // Check for version patterns (e.g., node:18.5.0 matches node:18)
  const versionMatch = normalizedImage.match(/^([^:]+):(\d+\.\d+)/);
  if (versionMatch) {
    const [, imageName, majorMinor] = versionMatch;
    const patternKey = `${imageName}:${majorMinor}`;
    if (dockerEOLData[patternKey]) {
      return dockerEOLData[patternKey];
    }
  }
  
  return {
    status: 'unknown',
    eol_date: null,
    description: 'Tuntematon base image'
  };
}

// Tarkista Django-versio EOL-tilassa
function checkDjangoEOL(version) {
  if (!version) {
    return {
      status: 'unknown',
      eol_date: null,
      description: 'Tuntematon versio'
    };
  }
  
  // Extract major.minor version (e.g., "3.2.15" -> "3.2")
  const majorMinor = version.match(/^(\d+\.\d+)/);
  const versionKey = majorMinor ? majorMinor[1] : version;
  
  if (!djangoEOLData[versionKey]) {
    return {
      status: 'unknown',
      eol_date: null,
      description: 'Tuntematon versio'
    };
  }
  
  const eolInfo = djangoEOLData[versionKey];
  
  // For supported versions, check if it's the latest patch version
  if (eolInfo.status === 'supported') {
    // Check if it's a patch version and if it's the latest
    const patchMatch = version.match(/^(\d+\.\d+)\.(\d+)$/);
    if (patchMatch) {
      const [, majorMinor, patch] = patchMatch;
      const latestPatch = getLatestPatchVersion(majorMinor);
      
      if (latestPatch && parseInt(patch) < parseInt(latestPatch)) {
        return {
          ...eolInfo,
          status: 'outdated',
          description: `Tuettu, mutta ei viimeisin patch-versio (viimeisin: ${majorMinor}.${latestPatch})`
        };
      }
    }
    
    return eolInfo;
  }
  
  return eolInfo;
}

// Get latest patch version for a major.minor version
function getLatestPatchVersion(majorMinor) {
  // This is a simplified version - in reality you'd want to fetch this from Django's API
  // or maintain a more comprehensive database
  const latestPatches = {
    '4.2': '24',
    '5.1': '8', 
    '5.2': '7'
  };
  
  return latestPatches[majorMinor] || null;
}

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
    const recentRepos = allRepos.filter(repo => !repo.archived);
    console.log(`🗃️ Arkistoitu: ${archivedCount}, Aktiivinen: ${recentRepos.length}`);

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


// Pääreitti
app.get('/', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }

    console.log('🚀 Aloitetaan repojen haku...');
    
    // Check if we should refresh data from API or use cached data
    const refreshData = req.query.refresh === 'true';
    let repositories;
    
    if (refreshData) {
      console.log('🔄 Päivitetään tiedot GitHub API:sta...');
      try {
        repositories = await getRecentRepositories();
        console.log(`📦 Repot haettu onnistuneesti: ${repositories.length} kpl`);
      } catch (error) {
        console.error('❌ Virhe repojen haussa:', error.message);
        repositories = [];
      }
    } else {
      console.log('💾 Käytetään tietokantaan tallennettuja tietoja...');
      try {
        repositories = await cacheManager.getRepositories();
        console.log(`📦 Repot haettu tietokannasta: ${repositories.length} kpl`);
        
        // Jos tietokannassa ei ole tietoja, hae API:sta
        if (repositories.length === 0) {
          console.log('💾 Tietokanta tyhjä, haetaan tiedot API:sta...');
          try {
            repositories = await getRecentRepositories();
            console.log(`📦 Repot haettu API:sta: ${repositories.length} kpl`);
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
    
    // Log final rate limit status
    const finalStatus = rateLimiter.getRateLimitStatus();
    console.log('📊 Lopullinen rate limit status:');
    console.log(`   - Käytetty: ${finalStatus.used}/${finalStatus.limit} (${Math.round((finalStatus.used/finalStatus.limit)*100)}%)`);
    console.log(`   - Jäljellä: ${finalStatus.remaining}`);
    console.log(`   - Reset: ${new Date(finalStatus.reset).toLocaleString('fi-FI')}`);
    console.log(`   - Concurrent: ${finalStatus.concurrentRequests}`);
    console.log(`   - Queue: ${finalStatus.queueLength}`);
    
    // Log cache statistics
    const cacheStats = await cacheManager.getStats();
    console.log('💾 Cache statistiikat:');
    console.log(`   - Hit rate: ${cacheStats.hitRate}`);
    console.log(`   - Hits: ${cacheStats.hits}, Misses: ${cacheStats.misses}`);
    console.log(`   - Cache size: ${cacheStats.size} entries`);
    console.log(`   - Memory usage: ${Math.round(cacheStats.memoryUsage / 1024 / 1024)} MB`);
    
    // Laske yhteenvedot
    const languageCounts = {
      PHP: 0,
      JavaScript: 0,
      Python: 0,
      Java: 0
    };
    
    const frameworkCounts = {
      React: 0,
      Django: 0,
      Drupal: 0,
      WordPress: 0
    };
    
    // Docker and Dependabot summary stats removed per requirements
    
    console.log('🔍 Lasketaan yhteenvedot...');
    console.log(`📊 Yhteensä ${repositories.length} reposta`);
    
    repositories.forEach(repo => {
      const repoName = repo.name.toLowerCase();
      const detectedLanguages = [];
      const detectedFrameworks = [];
      
      // Kieltiedot - tarkista sekä language että nimi
      if (repo.language === 'PHP' || repoName.includes('php')) {
        languageCounts.PHP++;
        detectedLanguages.push('PHP');
      }
      // Merge TypeScript into JavaScript
      if (repo.language === 'TypeScript' || repoName.includes('typescript') || repoName.includes('ts-')) {
        languageCounts.JavaScript++;
        detectedLanguages.push('JavaScript');
      }
      if (repo.language === 'JavaScript' || repoName.includes('javascript') || repoName.includes('js-') || repoName.includes('node')) {
        languageCounts.JavaScript++;
        detectedLanguages.push('JavaScript');
      }
      if (repo.language === 'Python' || repoName.includes('python') || repoName.includes('py-') || repoName.includes('django')) {
        languageCounts.Python++;
        detectedLanguages.push('Python');
      }
      if (repo.language === 'Java' || repoName.includes('java') || repoName.includes('spring')) {
        languageCounts.Java++;
        detectedLanguages.push('Java');
      }
      
      // Framework-tiedot - tarkista sekä versio että nimi
      if (repo.react_version || repoName.includes('react') || repoName.includes('nextjs') || repoName.includes('gatsby')) {
        frameworkCounts.React++;
        detectedFrameworks.push('React');
      }
      if (repo.django_version || repoName.includes('django')) {
        frameworkCounts.Django++;
        detectedFrameworks.push('Django');
      }
      if (repo.drupal_version || repoName.includes('drupal') || repoName.includes('drupal-') || repoName.includes('drupal_')) {
        frameworkCounts.Drupal++;
        detectedFrameworks.push('Drupal');
      }
      if (repoName.includes('wordpress') || repoName.includes('wp') || repoName.includes('WP') || repoName === 'wp' || repoName.includes('wp/')) {
        frameworkCounts.WordPress++;
        detectedFrameworks.push('WordPress');
      }
      
      // Docker and Dependabot summary aggregation removed per requirements
      
      // Debug-loki jokaiselle repolle
      if (detectedLanguages.length > 0 || detectedFrameworks.length > 0) {
        console.log(`📁 ${repo.name} (${repo.language}):`, {
          languages: detectedLanguages,
          frameworks: detectedFrameworks,
          reactVersion: repo.react_version,
          djangoVersion: repo.django_version,
          drupalVersion: repo.drupal_version
        });
      }
    });
    
    console.log('📈 Yhteenvedot:');
    console.log('Kielet:', languageCounts);
    console.log('Frameworkit:', frameworkCounts);
    console.log('🎯 Sivu renderöidään...');
    
    // Log missing owner summary
    logMissingOwnerSummary();
    
    res.render('index', {
      title: 'City of Helsinki - Sovellusportfolio',
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

        // Analyze Django versions with EOL data
        const versionStats = {};
        const eolStats = { eol: 0, supported: 0, outdated: 0, unknown: 0 };
        
        djangoRepos.forEach(repo => {
          const version = repo.django_version;
          versionStats[version] = (versionStats[version] || 0) + 1;
          
          // Check EOL status
          const eolInfo = checkDjangoEOL(version);
          eolStats[eolInfo.status] = (eolStats[eolInfo.status] || 0) + 1;
        });

    const sortedVersions = Object.entries(versionStats)
      .sort(([,a], [,b]) => b - a)
      .map(([version, count]) => {
        const eolInfo = checkDjangoEOL(version);
        return { 
          version, 
          count, 
          eol_info: eolInfo 
        };
      });

    console.log(`🐍 Django-repositoryt: ${djangoRepos.length} kpl`);
    console.log(`📊 Eri Django-versioita: ${sortedVersions.length} kpl`);

    res.render('django', {
      title: 'Django - Python-sovellukset',
      organization: GITHUB_ORG,
      djangoRepos: djangoRepos,
      noDjangoRepos: noDjangoRepos,
      versionStats: sortedVersions,
      eolStats: eolStats,
      stats: {
        totalRepos: githubRepos.length,
        pythonRepos: pythonRepos.length,
        djangoRepos: djangoRepos.length,
        noDjangoRepos: noDjangoRepos.length,
        uniqueVersions: sortedVersions.length
      },
      getLanguageColor: getLanguageColor,
      checkDjangoEOL: checkDjangoEOL
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

// Drupal route - Drupal applications page
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
  }
});

// Dependabot route - Security alerts page
app.get('/dependabot', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.render('error', {
        message: 'GitHub API konfiguraatio puuttuu. Tarkista .env tiedosto.',
        error: { status: 500 }
      });
    }

    console.log('🛡️ Aloitetaan Dependabot-sivun lataus...');
    
    // Get all repositories
    const githubRepos = await getRecentRepositories();
    console.log(`📦 GitHub repot haettu: ${githubRepos.length} kpl`);

    const reposWithAlerts = [];
    const reposWithoutAlerts = [];
    
    const batchSize = 5; // Smaller batch for Dependabot due to API limits
    for (let i = 0; i < githubRepos.length; i += batchSize) {
      const batch = githubRepos.slice(i, i + batchSize);
      console.log(`📦 Käsitellään Dependabot-batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(githubRepos.length/batchSize)}`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          const dependabotCount = await getDependabotDataForRepo(repo);
          return { ...repo, dependabot_critical_count: dependabotCount };
        })
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const repo = result.value;
          if (repo.dependabot_critical_count > 0) {
            reposWithAlerts.push(repo);
          } else {
            reposWithoutAlerts.push(repo);
          }
        } else {
          reposWithoutAlerts.push(batch[index]);
        }
      });
      
      if (i + batchSize < githubRepos.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for Dependabot
      }
    }

    const totalCriticalAlerts = reposWithAlerts.reduce((sum, repo) => sum + repo.dependabot_critical_count, 0);

    console.log(`🛡️ Repositoryt ilmoituksilla: ${reposWithAlerts.length} kpl`);
    console.log(`🛡️ Yhteensä kriittisiä ilmoituksia: ${totalCriticalAlerts} kpl`);

    res.render('dependabot', {
      title: 'Dependabot - Turvallisuusilmoitukset',
      organization: GITHUB_ORG,
      reposWithAlerts: reposWithAlerts,
      reposWithoutAlerts: reposWithoutAlerts,
      stats: {
        totalRepos: githubRepos.length,
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
});

// HDS route - Helsinki Design System page
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
});

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
    
    // Fetch Docker data for all repositories
    console.log(`🐳 Haetaan Docker-tiedot ${githubRepos.length} repositorylle...`);
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
          const dockerData = await getDockerDataForRepo(repo);
          console.log(`📊 Docker-tulos reposta ${repo.name}: ${dockerData ? 'Löytyi' : 'Ei Dockerfileä'}`);
          return {
            ...repo,
            docker_data: dockerData,
            docker_base_image: dockerData ? dockerData.primary : null
          };
        })
      );
      
      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const repo = result.value;
          if (repo.docker_base_image) {
            dockerRepos.push(repo);
            console.log(`✅ Docker-repo lisätty: ${repo.name}`);
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

    // Analyze Docker base images and EOL status
    const baseImageStats = {};
    const eolStats = { eol: 0, supported: 0, unknown: 0 };
    
    dockerRepos.forEach(repo => {
      const baseImage = repo.docker_base_image;
      baseImageStats[baseImage] = (baseImageStats[baseImage] || 0) + 1;
      
      // Check EOL status
      const eolInfo = checkDockerEOL(baseImage);
      repo.docker_eol = eolInfo;
      
      if (eolInfo.status === 'eol') {
        eolStats.eol++;
      } else if (eolInfo.status === 'supported') {
        eolStats.supported++;
      } else {
        eolStats.unknown++;
      }
    });

    // Sort by usage count
    const sortedBaseImages = Object.entries(baseImageStats)
      .sort(([,a], [,b]) => b - a)
      .map(([image, count]) => ({ 
        image, 
        count,
        eol: checkDockerEOL(image)
      }));

    console.log(`🐳 Docker-repositoryt: ${dockerRepos.length} kpl`);
    console.log(`📊 Eri base image -tyyppejä: ${sortedBaseImages.length} kpl`);
    console.log(`⚠️ EOL base imageit: ${eolStats.eol} kpl`);
    console.log(`✅ Tuetut base imageit: ${eolStats.supported} kpl`);

    res.render('dockerfile', {
      title: 'Dockerfile - Docker Repositoryt',
      organization: GITHUB_ORG,
      dockerRepos: dockerRepos,
      noDockerRepos: noDockerRepos,
      baseImageStats: sortedBaseImages,
      eolStats: eolStats,
      stats: {
        totalRepos: githubRepos.length,
        dockerRepos: dockerRepos.length,
        noDockerRepos: noDockerRepos.length,
        uniqueBaseImages: sortedBaseImages.length
      },
      getLanguageColor: getLanguageColor,
      checkDockerEOL: checkDockerEOL
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
app.get('/api/repos', async (req, res) => {
  try {
    const repositories = await getRecentRepositories();
    res.json(repositories);
  } catch (error) {
    res.status(500).json({ error: 'Virhe repojen haussa' });
  }
});

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
  const stats = await cacheManager.getStats();
  res.json({
    ...stats,
    memoryUsageMB: Math.round(stats.memoryUsage / 1024 / 1024),
    uptime: process.uptime()
  });
});

// Clear cache endpoint
app.post('/api/cache/clear', async (req, res) => {
  await cacheManager.clearAll();
  res.json({ message: 'Cache cleared successfully' });
});

// Clear specific repository cache
app.post('/api/cache/clear/:repoName', async (req, res) => {
  const { repoName } = req.params;
  await cacheManager.clearRepo(repoName);
  res.json({ message: `Cache cleared for repository: ${repoName}` });
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

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    message: 'Sivua ei löytynyt',
    error: { status: 404 }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    message: 'Sisäinen palvelinvirhe',
    error: { status: 500, stack: err.stack }
  });
});

app.listen(PORT, () => {
  console.log(`Sovellus käynnissä portissa ${PORT}`);
  console.log(`Avaa selain osoitteessa: http://localhost:${PORT}`);
});
