/**
 * Migration 001: Initial Schema
 * Creates initial tables and indexes
 */

module.exports = {
  version: '001',
  name: 'initial_schema',
  up: (db, callback) => {
    db.serialize(() => {
      // Cache table
      db.run(`CREATE TABLE IF NOT EXISTS cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )`, (err) => {
        if (err) {
          callback(err);
          return;
        }

        // Repositories table
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
          stargazers_count INTEGER DEFAULT 0,
          forks_count INTEGER DEFAULT 0,
          updated_at DATETIME,
          created_at DATETIME,
          topics TEXT,
          readme TEXT,
          docker_base_image TEXT,
          django_version TEXT,
          react_version TEXT,
          drupal_version TEXT,
          dependabot_critical_count INTEGER DEFAULT 0,
          owner TEXT,
          team TEXT,
          all_teams TEXT,
          dependabot_access TEXT,
          dependabot_permissions TEXT,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            callback(err);
            return;
          }

          // Create indexes
          db.run(`CREATE INDEX IF NOT EXISTS idx_cache_key ON cache(key)`, (err) => {
            if (err) {
              callback(err);
              return;
            }
          });

          db.run(`CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at)`, (err) => {
            if (err) {
              callback(err);
              return;
            }
          });

          db.run(`CREATE INDEX IF NOT EXISTS idx_repos_name ON repositories(name)`, (err) => {
            if (err) {
              callback(err);
              return;
            }
          });

          db.run(`CREATE INDEX IF NOT EXISTS idx_repos_updated ON repositories(updated_at)`, (err) => {
            if (err) {
              callback(err);
              return;
            }
          });

          db.run(`CREATE INDEX IF NOT EXISTS idx_repos_language ON repositories(language)`, (err) => {
            if (err) {
              callback(err);
              return;
            }
          });

          db.run(`CREATE INDEX IF NOT EXISTS idx_repos_full_name ON repositories(full_name)`, (err) => {
            if (err) {
              callback(err);
              return;
            }
          });

          callback(null);
        });
      });
    });
  }
};

