/**
 * Redis cache implementation
 * Optional Redis support with graceful fallback
 */

class RedisCache {
  constructor(redisClient) {
    this.client = redisClient;
    this.enabled = !!redisClient;
  }

  /**
   * Get cached value
   */
  async get(key) {
    if (!this.enabled) {
      return null;
    }

    try {
      const data = await this.client.get(key);
      if (!data) {
        return null;
      }
      return JSON.parse(data);
    } catch (error) {
      console.error('Redis get error:', error.message);
      return null;
    }
  }

  /**
   * Set cache value with TTL
   */
  async set(key, value, ttlMs) {
    if (!this.enabled) {
      return;
    }

    try {
      const data = JSON.stringify(value);
      const ttlSeconds = Math.floor(ttlMs / 1000);
      await this.client.setEx(key, ttlSeconds, data);
    } catch (error) {
      console.error('Redis set error:', error.message);
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key) {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis delete error:', error.message);
    }
  }

  /**
   * Delete multiple cache entries by pattern
   */
  async deleteByPattern(pattern) {
    if (!this.enabled) {
      return;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Redis deleteByPattern error:', error.message);
    }
  }

  /**
   * Check if Redis is available
   */
  async ping() {
    if (!this.enabled) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.enabled) {
      return { enabled: false };
    }

    try {
      const info = await this.client.info('stats');
      const keyspace = await this.client.info('keyspace');
      
      return {
        enabled: true,
        info: info || '',
        keyspace: keyspace || ''
      };
    } catch (error) {
      return { enabled: true, error: error.message };
    }
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.flushDb();
    } catch (error) {
      console.error('Redis clearAll error:', error.message);
    }
  }
}

module.exports = RedisCache;

