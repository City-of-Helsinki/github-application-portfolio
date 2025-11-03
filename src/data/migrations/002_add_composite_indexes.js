/**
 * Migration 002: Add Composite Indexes
 * Adds composite indexes for better query performance
 */

module.exports = {
  version: '002',
  name: 'add_composite_indexes',
  up: `
    CREATE INDEX IF NOT EXISTS idx_repos_language_updated 
    ON repositories(language, updated_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_repos_stars_updated 
    ON repositories(stargazers_count DESC, updated_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_cache_key_expires 
    ON cache(key, expires_at);
  `
};

