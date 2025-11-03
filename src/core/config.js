// Centralized configuration loader with minimal validation
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function requireEnv(name, defaultValue = undefined, options = {}) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) return defaultValue;
    if (options.optional) return undefined;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function toInt(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

function toBool(value, defaultValue) {
  if (value === undefined) return defaultValue;
  return value === 'true' || value === true;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),

  github: {
    baseUrl: process.env.GITHUB_API_BASE || 'https://api.github.com',
    token: requireEnv('GITHUB_TOKEN', undefined, { optional: true }),
    organization: process.env.GITHUB_ORG || 'City-of-Helsinki',
    userAgent: process.env.GITHUB_USER_AGENT || 'Application-Portfolio',
    timeoutMs: toInt(process.env.GITHUB_TIMEOUT_MS, 30000),
    maxRetries: toInt(process.env.GITHUB_MAX_RETRIES, 3),
    retryBaseDelayMs: toInt(process.env.GITHUB_RETRY_BASE_DELAY_MS, 300),
  },

  rateLimit: {
    enabled: toBool(process.env.RATE_LIMIT_ENABLED, true),
    debug: toBool(process.env.RATE_LIMIT_DEBUG, false),
  },

  app: {
    useDatabase: toBool(process.env.USE_DATABASE, true),
    maxRepositories: toInt(process.env.MAX_REPOSITORIES, undefined),
  },

  cache: {
    useRedis: toBool(process.env.USE_REDIS, false),
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: toInt(process.env.REDIS_PORT, 6379),
    redisPassword: process.env.REDIS_PASSWORD || undefined,
    redisDb: toInt(process.env.REDIS_DB, 0),
    defaultTtl: toInt(process.env.CACHE_DEFAULT_TTL, 3600000), // 1 hour in milliseconds
    cleanupInterval: toInt(process.env.CACHE_CLEANUP_INTERVAL, 600000), // 10 minutes
  },

  database: {
    path: process.env.DB_PATH || './portfolio.db',
    retryAttempts: toInt(process.env.DB_RETRY_ATTEMPTS, 3),
    retryDelay: toInt(process.env.DB_RETRY_DELAY, 1000),
    busyTimeout: toInt(process.env.DB_BUSY_TIMEOUT, 5000),
    enableWAL: toBool(process.env.DB_ENABLE_WAL, true),
    enableForeignKeys: toBool(process.env.DB_ENABLE_FOREIGN_KEYS, false),
  },
};

module.exports = { config };


