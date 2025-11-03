/**
 * Repository layer for database operations
 * Handles all database interactions for repositories
 */

const { config } = require('../../core/config');
const MigrationManager = require('../migrations/migrationManager');

class RepositoryRepository {
  constructor(db, migrationManager = null) {
    this.db = db;
    this.useDatabase = config.app.useDatabase;
    this.migrationManager = migrationManager;
  }

  /**
   * Initialize database tables and indexes
   * Uses migration system if available, otherwise falls back to direct SQL
   */
  async initialize() {
    if (!this.db || !this.useDatabase) {
      return;
    }

    // Use migration system if available
    if (this.migrationManager) {
      try {
        const migrations = [
          require('../migrations/001_initial_schema'),
          require('../migrations/002_add_composite_indexes')
        ];
        await this.migrationManager.runMigrations(migrations);
        return;
      } catch (error) {
        console.error('Migration failed, falling back to direct initialization:', error);
        // Fall through to direct initialization
      }
    }

    // Fallback to direct initialization
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Cache table
        this.db.run(`CREATE TABLE IF NOT EXISTS cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL
        )`, (err) => {
          if (err) {
            console.error('Error creating cache table:', err);
            reject(err);
            return;
          }
        });

        // Repository data table
        this.db.run(`CREATE TABLE IF NOT EXISTS repositories (
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
          owner TEXT,
          team TEXT,
          all_teams TEXT,
          dependabot_access TEXT,
          dependabot_permissions TEXT,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.error('Error creating repositories table:', err);
            reject(err);
            return;
          }
        });

        // Create indexes
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_cache_key ON cache(key)`, (err) => {
          if (err) console.error('Error creating cache index:', err);
        });
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at)`, (err) => {
          if (err) console.error('Error creating cache expires index:', err);
        });
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_name ON repositories(name)`, (err) => {
          if (err) console.error('Error creating repos name index:', err);
        });
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_updated ON repositories(updated_at)`, (err) => {
          if (err) console.error('Error creating repos updated index:', err);
        });
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_language ON repositories(language)`, (err) => {
          if (err) console.error('Error creating repos language index:', err);
        });
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_full_name ON repositories(full_name)`, (err) => {
          if (err) console.error('Error creating repos full_name index:', err);
        });
        
        // Create composite indexes for better query performance
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_language_updated 
          ON repositories(language, updated_at DESC)`, (err) => {
          if (err) console.error('Error creating composite index:', err);
        });
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_stars_updated 
          ON repositories(stargazers_count DESC, updated_at DESC)`, (err) => {
          if (err) console.error('Error creating composite index:', err);
        });

        // Check and add missing columns
        this.db.all(`PRAGMA table_info(repositories)`, (err, columns) => {
          if (err) {
            console.error('Error checking table columns:', err);
            reject(err);
            return;
          }

          const columnNames = columns.map(col => col.name);
          const migrations = [];

          if (!columnNames.includes('owner')) {
            migrations.push({ column: 'owner', type: 'TEXT' });
          }
          if (!columnNames.includes('team')) {
            migrations.push({ column: 'team', type: 'TEXT' });
          }
          if (!columnNames.includes('dependabot_access')) {
            migrations.push({ column: 'dependabot_access', type: 'TEXT' });
          }
          if (!columnNames.includes('all_teams')) {
            migrations.push({ column: 'all_teams', type: 'TEXT' });
          }
          if (!columnNames.includes('dependabot_permissions')) {
            migrations.push({ column: 'dependabot_permissions', type: 'TEXT' });
          }

          if (migrations.length === 0) {
            resolve();
            return;
          }

          let completed = 0;
          migrations.forEach(({ column, type }) => {
            this.db.run(`ALTER TABLE repositories ADD COLUMN ${column} ${type}`, (alterErr) => {
              if (alterErr) {
                console.error(`Error adding ${column} column:`, alterErr);
              } else {
                console.log(`✅ Added ${column} column to repositories table`);
              }
              completed++;
              if (completed === migrations.length) {
                resolve();
              }
            });
          });
        });
      });
    });
  }

  /**
   * Save repository to database
   */
  async saveRepository(repo) {
    if (!this.useDatabase || !this.db) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const owner = repo.owner || null;
      const team = repo.team || null;
      const all_teams = Array.isArray(repo.all_teams) ? JSON.stringify(repo.all_teams) : JSON.stringify([]);
      const dependabot_permissions = Array.isArray(repo.dependabot_permissions) 
        ? JSON.stringify(repo.dependabot_permissions) 
        : JSON.stringify([]);

      const repoData = {
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || null,
        html_url: repo.html_url || null,
        clone_url: repo.clone_url || null,
        homepage: repo.homepage || null,
        language: repo.language || null,
        languages: JSON.stringify(repo.languages || {}),
        stargazers_count: repo.stargazers_count || 0,
        forks_count: repo.forks_count || 0,
        updated_at: repo.updated_at || null,
        created_at: repo.created_at || null,
        topics: JSON.stringify(repo.topics || []),
        readme: repo.readme || null,
        docker_base_image: repo.docker_base_image || null,
        django_version: repo.django_version || null,
        react_version: repo.react_version || null,
        drupal_version: repo.drupal_version || null,
        wordpress_version: repo.wordpress_version || null,
        dependabot_critical_count: repo.dependabot_critical_count || 0,
        owner: owner,
        team: team,
        all_teams: all_teams,
        dependabot_access: repo.dependabot_access || null,
        dependabot_permissions: dependabot_permissions
      };

      this.db.run(
        `INSERT OR REPLACE INTO repositories (
          name, full_name, description, html_url, clone_url, homepage,
          language, languages, stargazers_count, forks_count, updated_at,
          created_at, topics, readme, docker_base_image, django_version,
          react_version, drupal_version, wordpress_version, dependabot_critical_count, owner, team, all_teams, dependabot_access, dependabot_permissions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        Object.values(repoData),
        (err) => {
          if (err) {
            console.error('Error saving repository:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get all repositories from database
   */
  async getAllRepositories(options = {}) {
    if (!this.useDatabase || !this.db) {
      return Promise.resolve([]);
    }

    const { 
      limit, 
      offset, 
      orderBy = 'updated_at', 
      orderDirection = 'DESC',
      language,
      minStars
    } = options;

    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM repositories WHERE 1=1';
      const params = [];

      if (language) {
        query += ' AND language = ?';
        params.push(language);
      }

      if (minStars !== undefined) {
        query += ' AND stargazers_count >= ?';
        params.push(minStars);
      }

      query += ` ORDER BY ${orderBy} ${orderDirection}`;

      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }

      if (offset) {
        query += ' OFFSET ?';
        params.push(offset);
      }

      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          reject(err);
          return;
        }

        const repositories = rows.map(row => ({
          ...row,
          languages: JSON.parse(row.languages || '{}'),
          topics: JSON.parse(row.topics || '[]'),
          all_teams: JSON.parse(row.all_teams || '[]'),
          dependabot_permissions: JSON.parse(row.dependabot_permissions || '[]')
        }));

        resolve(repositories);
      });
    });
  }

  /**
   * Get repository count
   */
  async getRepositoryCount(filters = {}) {
    if (!this.useDatabase || !this.db) {
      return Promise.resolve(0);
    }

    return new Promise((resolve, reject) => {
      let query = 'SELECT COUNT(*) as count FROM repositories WHERE 1=1';
      const params = [];

      if (filters.language) {
        query += ' AND language = ?';
        params.push(filters.language);
      }

      if (filters.minStars !== undefined) {
        query += ' AND stargazers_count >= ?';
        params.push(filters.minStars);
      }

      this.db.get(query, params, (err, row) => {
        if (err) {
          console.error('Database error:', err);
          reject(err);
          return;
        }

        resolve(row.count);
      });
    });
  }
}

module.exports = RepositoryRepository;

