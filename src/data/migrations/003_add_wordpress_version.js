/**
 * Migration 003: Add wordpress_version column to repositories table
 */

module.exports = {
  version: '003',
  name: 'add_wordpress_version',
  up: (db, callback) => {
    db.serialize(() => {
      // Check if column already exists (SQLite doesn't support IF NOT EXISTS for ALTER TABLE)
      db.get(`PRAGMA table_info(repositories)`, (err, rows) => {
        if (err) {
          callback(err);
          return;
        }

        // Check if wordpress_version column exists
        db.all(`PRAGMA table_info(repositories)`, (err, columns) => {
          if (err) {
            callback(err);
            return;
          }

          const hasWordPressVersion = columns.some(col => col.name === 'wordpress_version');

          if (!hasWordPressVersion) {
            // Add wordpress_version column
            db.run(`ALTER TABLE repositories ADD COLUMN wordpress_version TEXT`, (err) => {
              if (err) {
                callback(err);
                return;
              }

              console.log('✅ Added wordpress_version column to repositories table');
              callback(null);
            });
          } else {
            console.log('✅ wordpress_version column already exists');
            callback(null);
          }
        });
      });
    });
  },
  down: (db, callback) => {
    // SQLite doesn't support dropping columns easily
    // This would require recreating the table, which is complex
    // For now, we'll just log a warning
    console.warn('⚠️ SQLite does not support dropping columns. Migration down not implemented.');
    callback(null);
  }
};

