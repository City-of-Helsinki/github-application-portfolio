/**
 * Repository layer for cache operations
 * Handles all cache-related database operations
 */

class CacheRepository {
  constructor(db, useDatabase) {
    this.db = db;
    this.useDatabase = useDatabase;
    this.memoryCache = new Map();
  }

  /**
   * Get cache entry by key
   */
  async get(key) {
    if (!this.useDatabase || !this.db) {
      return this.memoryCache.get(key)?.value || null;
    }

    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM cache WHERE key = ? AND expires_at > datetime("now")',
        [key],
        (err, row) => {
          if (err) {
            console.error('Cache get error:', err);
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          try {
            const data = JSON.parse(row.data);
            resolve(data);
          } catch (parseError) {
            console.error('Error parsing cache data:', parseError);
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Set cache entry
   */
  async set(key, value, ttlMs) {
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    if (!this.useDatabase || !this.db) {
      this.memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      // Clean expired entries periodically
      if (this.memoryCache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of this.memoryCache.entries()) {
          if (v.expiresAt < now) {
            this.memoryCache.delete(k);
          }
        }
      }
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(value);
      this.db.run(
        'INSERT OR REPLACE INTO cache (key, data, expires_at) VALUES (?, ?, ?)',
        [key, data, expiresAt],
        (err) => {
          if (err) {
            console.error('Cache set error:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Delete cache entry
   */
  async delete(key) {
    if (!this.useDatabase || !this.db) {
      this.memoryCache.delete(key);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM cache WHERE key = ?', [key], (err) => {
        if (err) {
          console.error('Cache delete error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear cache entries for a repository
   */
  async clearRepo(repoName) {
    if (!this.useDatabase || !this.db) {
      const prefix = `${repoName}:`;
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key);
        }
      }
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM cache WHERE key LIKE ?', [`${repoName}:%`], (err) => {
        if (err) {
          console.error('Cache clearRepo error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear all cache entries
   */
  async clearAll() {
    if (!this.useDatabase || !this.db) {
      this.memoryCache.clear();
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM cache', (err) => {
        if (err) {
          console.error('Cache clearAll error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpired() {
    if (!this.useDatabase || !this.db) {
      const now = Date.now();
      let cleaned = 0;
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expiresAt < now) {
          this.memoryCache.delete(key);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired cache entries from memory`);
      }
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM cache WHERE expires_at <= datetime("now")', (err) => {
        if (err) {
          console.error('Cache clean error:', err);
          reject(err);
        } else {
          console.log('🧹 Cleaned expired cache entries from database');
          resolve();
        }
      });
    });
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.useDatabase || !this.db) {
      return {
        size: this.memoryCache.size,
        type: 'memory'
      };
    }

    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM cache', (err, row) => {
        if (err) {
          console.error('Cache stats error:', err);
          reject(err);
        } else {
          resolve({
            size: row.count,
            type: 'database'
          });
        }
      });
    });
  }
}

module.exports = CacheRepository;

