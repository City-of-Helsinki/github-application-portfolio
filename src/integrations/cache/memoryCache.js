// Simple in-memory TTL cache
class MemoryCache {
  constructor() {
    this.map = new Map();
  }

  set(key, value, ttlMs) {
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    this.map.set(key, { value, expiresAt });
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  del(key) {
    this.map.delete(key);
  }
}

const defaultCache = new MemoryCache();

module.exports = { MemoryCache, defaultCache };


