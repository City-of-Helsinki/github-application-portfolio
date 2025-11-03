/**
 * Unified cache manager
 * Supports Redis, SQLite, and in-memory caching with fallback
 */

class UnifiedCacheManager {
  constructor(redisCache, cacheRepository, config) {
    this.redisCache = redisCache;
    this.cacheRepository = cacheRepository;
    this.config = config;
    this.useRedis = config?.cache?.useRedis || false;
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      totalRequests: 0,
      redisHits: 0,
      redisMisses: 0,
      dbHits: 0,
      dbMisses: 0,
      memoryHits: 0,
      memoryMisses: 0,
      errors: 0
    };

    this.pendingRequests = new Map(); // Request deduplication
  }

  /**
   * Get cached value with automatic fallback
   */
  async get(key) {
    this.stats.totalRequests++;

    try {
      let value = null;

      // Try Redis first if enabled
      if (this.useRedis && this.redisCache.enabled) {
        try {
          value = await this.redisCache.get(key);
          if (value !== null) {
            this.stats.hits++;
            this.stats.redisHits++;
            return value;
          }
          this.stats.redisMisses++;
        } catch (error) {
          console.warn('Redis get failed, falling back:', error.message);
          this.stats.errors++;
        }
      }

      // Fallback to database/memory cache
      try {
        value = await this.cacheRepository.get(key);
        if (value !== null) {
          this.stats.hits++;
          this.stats.dbHits++;
          return value;
        }
        this.stats.dbMisses++;
      } catch (error) {
        console.warn('Cache repository get failed:', error.message);
        this.stats.errors++;
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      this.stats.errors++;
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set cache value with TTL
   */
  async set(key, value, ttlMs = null) {
    this.stats.sets++;

    const ttl = ttlMs || this.config?.cache?.defaultTtl || 3600000; // Default 1 hour

    try {
      // Set in Redis if enabled
      if (this.useRedis && this.redisCache.enabled) {
        try {
          await this.redisCache.set(key, value, ttl);
        } catch (error) {
          console.warn('Redis set failed, using fallback:', error.message);
          this.stats.errors++;
        }
      }

      // Always set in database/memory as fallback
      try {
        await this.cacheRepository.set(key, value, ttl);
      } catch (error) {
        console.error('Cache repository set failed:', error.message);
        this.stats.errors++;
      }
    } catch (error) {
      console.error('Cache set error:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key) {
    this.stats.deletes++;

    try {
      // Delete from Redis if enabled
      if (this.useRedis && this.redisCache.enabled) {
        try {
          await this.redisCache.delete(key);
        } catch (error) {
          console.warn('Redis delete failed:', error.message);
        }
      }

      // Delete from database/memory
      await this.cacheRepository.delete(key);
    } catch (error) {
      console.error('Cache delete error:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Delete cache entries by pattern
   */
  async deleteByPattern(pattern) {
    try {
      // Delete from Redis if enabled
      if (this.useRedis && this.redisCache.enabled) {
        try {
          await this.redisCache.deleteByPattern(pattern);
        } catch (error) {
          console.warn('Redis deleteByPattern failed:', error.message);
        }
      }

      // For database, we'd need to implement pattern matching
      // For now, this is Redis-specific
    } catch (error) {
      console.error('Cache deleteByPattern error:', error.message);
    }
  }

  /**
   * Invalidate cache for a repository
   */
  async invalidateRepo(repoName) {
    const patterns = [
      `${repoName}:*`,
      `org_repos_*`,
      `latest_commit_data_*_${repoName}`,
      `collaborators_*_${repoName}`
    ];

    for (const pattern of patterns) {
      await this.deleteByPattern(pattern);
    }

    // Also clear repository-specific keys from database
    try {
      await this.cacheRepository.clearRepo(repoName);
    } catch (error) {
      console.error('Cache repository clearRepo error:', error.message);
    }
  }

  /**
   * Deduplicate concurrent requests
   */
  async deduplicateRequest(requestKey, requestFn) {
    if (this.pendingRequests.has(requestKey)) {
      console.log(`🔄 Deduplicating request: ${requestKey}`);
      return this.pendingRequests.get(requestKey);
    }

    const promise = (async () => {
      try {
        const result = await requestFn();
        return result;
      } finally {
        this.pendingRequests.delete(requestKey);
      }
    })();

    this.pendingRequests.set(requestKey, promise);
    return promise;
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpired() {
    try {
      // Redis handles TTL automatically, but we can trigger cleanup
      if (this.useRedis && this.redisCache.enabled) {
        // Redis automatically expires keys, no manual cleanup needed
      }

      // Clean database cache
      await this.cacheRepository.cleanExpired();
    } catch (error) {
      console.error('Cache cleanExpired error:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.totalRequests > 0
      ? ((this.stats.hits / this.stats.totalRequests) * 100).toFixed(2)
      : 0;

    const redisHitRate = (this.stats.redisHits + this.stats.redisMisses) > 0
      ? ((this.stats.redisHits / (this.stats.redisHits + this.stats.redisMisses)) * 100).toFixed(2)
      : 0;

    const dbHitRate = (this.stats.dbHits + this.stats.dbMisses) > 0
      ? ((this.stats.dbHits / (this.stats.dbHits + this.stats.dbMisses)) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      redisHitRate: `${redisHitRate}%`,
      dbHitRate: `${dbHitRate}%`,
      useRedis: this.useRedis && this.redisCache.enabled,
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    try {
      // Clear pending requests
      this.pendingRequests.clear();

      // Clear Redis if enabled
      if (this.useRedis && this.redisCache.enabled) {
        await this.redisCache.clearAll();
      }

      // Clear database cache
      await this.cacheRepository.clearAll();

      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        totalRequests: 0,
        redisHits: 0,
        redisMisses: 0,
        dbHits: 0,
        dbMisses: 0,
        memoryHits: 0,
        memoryMisses: 0,
        errors: 0
      };
    } catch (error) {
      console.error('Cache clearAll error:', error.message);
    }
  }

  /**
   * Get cache info for monitoring
   */
  async getInfo() {
    const stats = this.getStats();
    const redisInfo = this.useRedis && this.redisCache.enabled
      ? await this.redisCache.getStats()
      : { enabled: false };

    return {
      stats,
      redis: redisInfo,
      configuration: {
        useRedis: this.useRedis && this.redisCache.enabled,
        defaultTtl: this.config?.cache?.defaultTtl || 3600000,
        repositoryType: this.cacheRepository.useDatabase ? 'database' : 'memory'
      }
    };
  }
}

module.exports = UnifiedCacheManager;

