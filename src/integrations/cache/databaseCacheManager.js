/**
 * Database-based cache manager
 * Handles caching with TTL support and request deduplication
 */

class DatabaseCacheManager {
  constructor(cacheRepository) {
    this.cacheRepository = cacheRepository;
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      totalRequests: 0
    };
    this.pendingRequests = new Map(); // For request deduplication
  }

  /**
   * Generate cache key for repository data
   */
  getCacheKey(repoName, dataType) {
    return `${repoName}:${dataType}`;
  }

  /**
   * Get cached value
   */
  async get(key) {
    this.cacheStats.totalRequests++;
    
    const cached = await this.cacheRepository.get(key);
    
    if (cached !== null) {
      this.cacheStats.hits++;
      return cached;
    } else {
      this.cacheStats.misses++;
      return null;
    }
  }

  /**
   * Set cache value with TTL
   */
  async set(key, value, ttlMs) {
    this.cacheStats.sets++;
    await this.cacheRepository.set(key, value, ttlMs);
  }

  /**
   * Delete cache entry
   */
  async delete(key) {
    await this.cacheRepository.delete(key);
  }

  /**
   * Deduplicate concurrent requests
   */
  async deduplicateRequest(key, fn) {
    // If request is already pending, wait for it
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    // Create new request promise
    const promise = (async () => {
      try {
        const result = await fn();
        return result;
      } finally {
        this.pendingRequests.delete(key);
      }
    })();

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpired() {
    await this.cacheRepository.cleanExpired();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.cacheStats.totalRequests > 0
      ? (this.cacheStats.hits / this.cacheStats.totalRequests * 100).toFixed(2)
      : 0;

    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      sets: this.cacheStats.sets,
      totalRequests: this.cacheStats.totalRequests,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    // Clear all pending requests
    this.pendingRequests.clear();
    
    // Clear cache repository (would need implementation)
    // For now, just reset stats
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      totalRequests: 0
    };
  }
}

module.exports = DatabaseCacheManager;

