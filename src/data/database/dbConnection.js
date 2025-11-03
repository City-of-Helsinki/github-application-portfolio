/**
 * Database Connection Manager
 * Handles database connections with pooling, retry logic, and error handling
 */

const sqlite3 = require('sqlite3').verbose();
const { config } = require('../../core/config');

class DatabaseConnection {
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.options = {
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      busyTimeout: options.busyTimeout || 5000,
      ...options
    };
    this.db = null;
    this.isConnected = false;
  }

  /**
   * Open database connection with retry logic
   */
  async connect() {
    if (this.isConnected && this.db) {
      return this.db;
    }

    let attempts = 0;
    while (attempts < this.options.retryAttempts) {
      try {
        this.db = await this._createConnection();
        this.isConnected = true;
        console.log('✅ Database connection established');
        return this.db;
      } catch (error) {
        attempts++;
        if (attempts >= this.options.retryAttempts) {
          console.error('❌ Failed to connect to database after', this.options.retryAttempts, 'attempts');
          throw error;
        }
        console.warn(`⚠️ Database connection attempt ${attempts} failed, retrying...`);
        await this._delay(this.options.retryDelay * attempts);
      }
    }
  }

  /**
   * Create database connection
   */
  _createConnection() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          // Configure database
          db.configure('busyTimeout', this.options.busyTimeout);
          
          // Enable foreign keys if requested
          if (config.database.enableForeignKeys) {
            db.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
              if (pragmaErr) {
                console.warn('Warning: Could not enable foreign keys:', pragmaErr.message);
              }
            });
          }

          // Set journal mode
          const trySetJournalMode = (mode, onDone) => {
            db.run(`PRAGMA journal_mode = ${mode}`, (err) => {
              if (err) {
                return onDone(err);
              }
              onDone();
            });
          };

          if (config.database.enableWAL) {
            trySetJournalMode('WAL', (walErr) => {
              if (walErr) {
                console.warn('Warning: Could not set WAL mode:', walErr.message);
                // Fallback to DELETE mode to avoid SQLITE_BUSY on some FS
                trySetJournalMode('DELETE', (delErr) => {
                  if (delErr) {
                    console.warn('Warning: Could not set DELETE journal mode:', delErr.message);
                  }
                });
              }
            });
          } else {
            trySetJournalMode('DELETE', (delErr) => {
              if (delErr) {
                console.warn('Warning: Could not set DELETE journal mode:', delErr.message);
              }
            });
          }

          // Set synchronous mode for better performance
          db.run('PRAGMA synchronous = NORMAL', (syncErr) => {
            if (syncErr) {
              console.warn('Warning: Could not set synchronous mode:', syncErr.message);
            }
          });

          resolve(db);
        }
      });

      // Handle database errors
      db.on('error', (err) => {
        console.error('Database error:', err);
        this.isConnected = false;
      });
    });
  }

  /**
   * Execute query with retry logic
   */
  async execute(query, params = [], options = {}) {
    const maxRetries = options.retries || this.options.retryAttempts;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        if (!this.isConnected || !this.db) {
          await this.connect();
        }

        return await this._runQuery(query, params);
      } catch (error) {
        attempts++;
        
        // Don't retry on constraint violations
        if (error.code === 'SQLITE_CONSTRAINT' || error.message.includes('UNIQUE constraint')) {
          throw error;
        }

        if (attempts >= maxRetries) {
          console.error(`❌ Query failed after ${maxRetries} attempts:`, query);
          throw error;
        }

        console.warn(`⚠️ Query attempt ${attempts} failed, retrying...`);
        await this._delay(this.options.retryDelay * attempts);
        
        // Reconnect if connection is lost
        if (!this.isConnected) {
          await this.connect();
        }
      }
    }
  }

  /**
   * Run query
   */
  _runQuery(query, params) {
    return new Promise((resolve, reject) => {
      if (query.trim().toUpperCase().startsWith('SELECT')) {
        this.db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      } else {
        this.db.run(query, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ lastID: this.lastID, changes: this.changes });
          }
        });
      }
    });
  }

  /**
   * Get database connection
   */
  getConnection() {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.isConnected = false;
          this.db = null;
          console.log('✅ Database connection closed');
          resolve();
        }
      });
    });
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run transaction
   */
  async transaction(callback) {
    if (!this.isConnected || !this.db) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION', (beginErr) => {
          if (beginErr) {
            reject(beginErr);
            return;
          }

          callback(this.db, (callbackErr, result) => {
            if (callbackErr) {
              this.db.run('ROLLBACK', () => {
                reject(callbackErr);
              });
            } else {
              this.db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  reject(commitErr);
                } else {
                  resolve(result);
                }
              });
            }
          });
        });
      });
    });
  }
}

module.exports = DatabaseConnection;

