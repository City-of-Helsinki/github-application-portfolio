/**
 * Migration Manager
 * Handles database schema migrations
 */

const fs = require('fs');
const path = require('path');

class MigrationManager {
  constructor(db) {
    this.db = db;
    this.migrationsTableName = 'schema_migrations';
  }

  /**
   * Initialize migrations table
   */
  async initializeMigrationsTable() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS ${this.migrationsTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get executed migrations
   */
  async getExecutedMigrations() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT version FROM ${this.migrationsTableName} ORDER BY executed_at`,
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => row.version));
          }
        }
      );
    });
  }

  /**
   * Record migration as executed
   */
  async recordMigration(version, name) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO ${this.migrationsTableName} (version, name) VALUES (?, ?)`,
        [version, name],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Execute a migration
   */
  async executeMigration(migration) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION', (beginErr) => {
          if (beginErr) {
            reject(beginErr);
            return;
          }

          // Execute migration SQL
          if (typeof migration.up === 'function') {
            migration.up(this.db, (migrationErr) => {
              if (migrationErr) {
                this.db.run('ROLLBACK', () => {
                  reject(migrationErr);
                });
                return;
              }

              // Record migration
              this.recordMigration(migration.version, migration.name)
                .then(() => {
                  this.db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      reject(commitErr);
                    } else {
                      console.log(`✅ Migration ${migration.version}: ${migration.name} executed`);
                      resolve();
                    }
                  });
                })
                .catch((recordErr) => {
                  this.db.run('ROLLBACK', () => {
                    reject(recordErr);
                  });
                });
            });
          } else {
            // SQL string migration
            this.db.run(migration.up, (migrationErr) => {
              if (migrationErr) {
                this.db.run('ROLLBACK', () => {
                  reject(migrationErr);
                });
                return;
              }

              // Record migration
              this.recordMigration(migration.version, migration.name)
                .then(() => {
                  this.db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      reject(commitErr);
                    } else {
                      console.log(`✅ Migration ${migration.version}: ${migration.name} executed`);
                      resolve();
                    }
                  });
                })
                .catch((recordErr) => {
                  this.db.run('ROLLBACK', () => {
                    reject(recordErr);
                  });
                });
            });
          }
        });
      });
    });
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(migrations = []) {
    try {
      await this.initializeMigrationsTable();
      const executed = await this.getExecutedMigrations();

      // Sort migrations by version
      const sortedMigrations = migrations
        .filter(m => !executed.includes(m.version))
        .sort((a, b) => a.version.localeCompare(b.version));

      if (sortedMigrations.length === 0) {
        console.log('✅ All migrations are up to date');
        return;
      }

      console.log(`📦 Running ${sortedMigrations.length} pending migration(s)...`);

      for (const migration of sortedMigrations) {
        await this.executeMigration(migration);
      }

      console.log('✅ All migrations completed');
    } catch (error) {
      console.error('❌ Migration error:', error);
      throw error;
    }
  }
}

module.exports = MigrationManager;

