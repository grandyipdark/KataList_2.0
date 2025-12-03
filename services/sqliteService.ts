
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

let db: any = null;

const LOG_TAG = '[SQLite]';

export const sqliteService = {
  init: async (): Promise<boolean> => {
    if (db) return true; // Already initialized

    try {
      console.log(`${LOG_TAG} Loading module...`);
      
      let sqlite3;
      try {
          // Attempt to load WASM. If header isolation is missing, this might fail or return a non-OPFS ready instance.
          // We wrap it to avoid loud unhandled rejections in console for unsupported envs.
          sqlite3 = await sqlite3InitModule({
            print: console.log,
            printErr: (msg: string) => {
                // Filter out some noisy errors during init check if fallback is available
                if (msg.includes('OPFS') || msg.includes('headers')) {
                    console.warn(msg);
                } else {
                    console.error(msg);
                }
            },
          });
      } catch(loadError) {
          console.warn(`${LOG_TAG} WASM module failed to load (likely unsupported environment or missing headers). Fallback to IDB.`);
          return false;
      }

      try {
        console.log(`${LOG_TAG} Checking OPFS support...`);
        if (sqlite3 && 'opfs' in sqlite3) {
          db = new sqlite3.oo1.OpfsDb('/katalist.db');
          console.log(`${LOG_TAG} OPFS Database opened successfully.`);
        } else {
          console.warn(`${LOG_TAG} OPFS not available.`);
          // CRITICAL: Return false to force fallback to IDB. 
          // Do NOT use memory DB as it loses data on refresh.
          return false; 
        }
      } catch (e) {
        console.error(`${LOG_TAG} OPFS Error`, e);
        return false;
      }

      // Initialize Tables (Document Store Pattern) with Consistent Schema
      // Added created_at to ALL tables to support generic getAll sorting
      const tables = ['tastings', 'categories', 'lists'];
      
      db.transaction(() => {
          tables.forEach(table => {
              db.exec(`
                CREATE TABLE IF NOT EXISTS ${table} (
                  id TEXT PRIMARY KEY,
                  body TEXT NOT NULL,
                  created_at INTEGER
                );
              `);
              
              // MIGRATION FIX: Ensure created_at exists (for DBs created in previous broken attempts)
              try {
                  // Attempt to select the column. If it fails, add it.
                  db.exec(`SELECT created_at FROM ${table} LIMIT 1`);
              } catch (e) {
                  console.log(`${LOG_TAG} Migrating schema for ${table}: Adding created_at`);
                  try {
                      db.exec(`ALTER TABLE ${table} ADD COLUMN created_at INTEGER`);
                  } catch(err) {
                      console.warn("Column might already exist or alter failed", err);
                  }
              }
          });

          // Images table is simpler
          db.exec(`
            CREATE TABLE IF NOT EXISTS images (
              id TEXT PRIMARY KEY,
              data TEXT NOT NULL
            );
          `);
      });

      return true;
    } catch (e) {
      console.error(`${LOG_TAG} Initialization failed:`, e);
      return false;
    }
  },

  // --- GENERIC CRUD ---

  getAll: async (table: string) => {
    if (!db) return [];
    try {
      const result: any[] = [];
      // Use 'exec' with a callback row for best performance in the WASM wrapper
      db.exec({
        sql: `SELECT body FROM ${table} ORDER BY created_at DESC`,
        rowMode: 'array',
        callback: (row: any[]) => {
          try {
            if (row[0]) result.push(JSON.parse(row[0]));
          } catch (e) {
            console.error(`Error parsing JSON from ${table}`, e);
          }
        }
      });
      return result;
    } catch (e) {
      console.error(`${LOG_TAG} getAll error in ${table}`, e);
      // Fallback: Try without ordering if schema is somehow still broken
      try {
          const result: any[] = [];
          db.exec({
            sql: `SELECT body FROM ${table}`,
            rowMode: 'array',
            callback: (row: any[]) => {
               if (row[0]) result.push(JSON.parse(row[0]));
            }
          });
          return result;
      } catch(e2) {
          return [];
      }
    }
  },

  getById: async (table: string, id: string) => {
    if (!db) return null;
    try {
      const row = db.exec({
        sql: `SELECT body FROM ${table} WHERE id = ?`,
        bind: [id],
        rowMode: 'array',
        returnValue: 'resultRows'
      });
      if (row && row.length > 0 && row[0][0]) {
        return JSON.parse(row[0][0]);
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  // Optimized for images (raw text/blob, not JSON wrapped)
  getImage: async (id: string) => {
    if (!db) return null;
    try {
      const row = db.exec({
        sql: `SELECT data FROM images WHERE id = ?`,
        bind: [id],
        rowMode: 'array',
        returnValue: 'resultRows'
      });
      if (row && row.length > 0) {
        return row[0][0];
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  save: async (table: string, item: any) => {
    if (!db) throw new Error("DB not initialized");
    try {
      const id = item.id;
      const body = JSON.stringify(item);
      // Ensure createdAt exists for the sort column, even if not in JSON body (e.g. categories)
      const createdAt = item.createdAt || Date.now();

      // Upsert logic for standard tables
      db.exec({
          sql: `INSERT INTO ${table}(id, body, created_at) VALUES(?, ?, ?) 
                ON CONFLICT(id) DO UPDATE SET body=excluded.body, created_at=excluded.created_at`,
          bind: [id, body, createdAt]
      });
    } catch (e) {
      console.error(`${LOG_TAG} Save error`, e);
      throw e;
    }
  },

  saveImage: async (id: string, data: string) => {
    if (!db) throw new Error("DB not initialized");
    db.exec({
      sql: `INSERT INTO images(id, data) VALUES(?, ?) 
            ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
      bind: [id, data]
    });
  },

  delete: async (table: string, id: string) => {
    if (!db) return;
    db.exec({
      sql: `DELETE FROM ${table} WHERE id = ?`,
      bind: [id]
    });
  },

  // --- UTILS ---
  isEmpty: async () => {
    if (!db) return true;
    try {
      const res = db.exec({
        sql: `SELECT count(*) FROM tastings`,
        rowMode: 'array',
        returnValue: 'resultRows'
      });
      return res[0][0] === 0;
    } catch (e) {
      return true;
    }
  },
  
  // Bulk transaction for migration
  saveBulk: async (table: string, items: any[]) => {
    if (!db || items.length === 0) return;
    try {
      db.transaction(() => {
        for (const item of items) {
          const id = item.id;
          const body = JSON.stringify(item);
          const createdAt = item.createdAt || Date.now();
          
          db.exec({ 
              sql: `INSERT OR REPLACE INTO ${table}(id, body, created_at) VALUES(?, ?, ?)`, 
              bind: [id, body, createdAt] 
          });
        }
      });
    } catch (e) {
      console.error("Bulk save error", e);
    }
  },
  
  saveImagesBulk: async (images: {id: string, data: string}[]) => {
      if (!db || images.length === 0) return;
      try {
          db.transaction(() => {
              for (const img of images) {
                  db.exec({ sql: `INSERT OR REPLACE INTO images(id, data) VALUES(?, ?)`, bind: [img.id, img.data] });
              }
          });
      } catch (e) {
          console.error("Bulk image save error", e);
      }
  }
};
