/**
 * Unit tests for Cache Managers
 */

const UnifiedCacheManager = require('../../src/integrations/cache/unifiedCacheManager');
const CacheRepository = require('../../src/data/repositories/cacheRepository');

describe('UnifiedCacheManager', () => {
  let cacheManager;
  let mockRedisCache;
  let mockCacheRepository;
  let mockConfig;

  beforeEach(() => {
    mockRedisCache = {
      enabled: false,
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(),
      delete: jest.fn().mockResolvedValue(),
      deleteByPattern: jest.fn().mockResolvedValue(),
      clearAll: jest.fn().mockResolvedValue()
    };

    mockCacheRepository = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clearRepo: jest.fn(),
      clearAll: jest.fn(),
      cleanExpired: jest.fn()
    };

    mockConfig = {
      cache: {
        defaultTtl: 3600000
      }
    };

    cacheManager = new UnifiedCacheManager(
      mockRedisCache,
      mockCacheRepository,
      mockConfig
    );
  });

  describe('get', () => {
    it('should get value from cache repository when Redis is disabled', async () => {
      mockCacheRepository.get.mockResolvedValue({ data: 'test' });

      const result = await cacheManager.get('test-key');

      expect(mockCacheRepository.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual({ data: 'test' });
    });

    it('should try Redis first when enabled', async () => {
      mockRedisCache.enabled = true;
      mockRedisCache.get.mockResolvedValue({ data: 'redis-value' });
      cacheManager.useRedis = true;

      const result = await cacheManager.get('test-key');

      expect(mockRedisCache.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual({ data: 'redis-value' });
    });

    it('should fallback to repository when Redis fails', async () => {
      mockRedisCache.enabled = true;
      mockRedisCache.get.mockRejectedValue(new Error('Redis error'));
      mockCacheRepository.get.mockResolvedValue({ data: 'fallback' });

      const result = await cacheManager.get('test-key');

      expect(mockCacheRepository.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual({ data: 'fallback' });
    });
  });

  describe('set', () => {
    it('should set value in both Redis and repository when Redis is enabled', async () => {
      mockRedisCache.enabled = true;
      mockRedisCache.set.mockResolvedValue();
      mockCacheRepository.set.mockResolvedValue();
      cacheManager.useRedis = true;

      await cacheManager.set('test-key', { data: 'test' }, 3600000);

      expect(mockRedisCache.set).toHaveBeenCalled();
      expect(mockCacheRepository.set).toHaveBeenCalled();
    });

    it('should only set in repository when Redis is disabled', async () => {
      await cacheManager.set('test-key', { data: 'test' }, 3600000);

      expect(mockRedisCache.set).not.toHaveBeenCalled();
      expect(mockCacheRepository.set).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      // Set some stats
      cacheManager.stats.hits = 10;
      cacheManager.stats.misses = 5;
      cacheManager.stats.totalRequests = 15;

      const stats = cacheManager.getStats();

      expect(stats).toHaveProperty('hits', 10);
      expect(stats).toHaveProperty('misses', 5);
      expect(stats).toHaveProperty('hitRate');
    });
  });

  describe('invalidateRepo', () => {
    it('should invalidate repository cache', async () => {
      mockRedisCache.enabled = true;
      mockRedisCache.deleteByPattern.mockResolvedValue();
      mockCacheRepository.clearRepo.mockResolvedValue();
      cacheManager.useRedis = true;

      await cacheManager.invalidateRepo('test-repo');

      expect(mockRedisCache.deleteByPattern).toHaveBeenCalled();
      expect(mockCacheRepository.clearRepo).toHaveBeenCalledWith('test-repo');
    });
  });
});

