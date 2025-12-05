
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

let db: any = null;

const LOG_TAG = '[SQLite]';

// Internal initialization logic
const initializeInternal = async (): Promise<boolean> => {
    try {
      console.log(`${LOG_TAG} Loading module...`);
      
      let sqlite3;
      try {
          // Attempt to load WASM. If header isolation is missing, this might fail or return a non-OPFS ready instance.
          sqlite3 = await sqlite3InitModule({
            print: console.log,
            printErr: (msg: string) => {
                if (msg.includes('OPFS') || msg.includes('headers')) {
                    console.warn(msg);
                } else {
                    console.error(msg);
                }
            },
          });
      } catch(loadError) {
          console.warn(`${LOG_TAG} WASM module failed to load. Fallback to IDB.`);
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
          return false; 
        }
      } catch (e) {
        console.error(`${LOG_TAG} OPFS Error`, e);
        return false;
      }

      // Initialize Tables (Document Store Pattern)
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
              
              // MIGRATION FIX: Ensure created_at exists
              try {
                  db.exec(`SELECT created_at FROM ${table} LIMIT 1`);
              } catch (e) {
                  try {
                      db.exec(`ALTER TABLE ${table} ADD COLUMN created_at INTEGER`);
                  } catch(err) {
                      console.warn("Column migration failed or exists", err);
                  }
              }
          });

          // Images table
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
};

export const sqliteService = {
  init: async (): Promise<boolean> => {
    if (db) return true; // Already initialized

    // Race condition: If WASM hangs due to missing headers, fallback after 3 seconds.
    const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
            console.warn(`${LOG_TAG} Init timed out (3s). Fallback to IDB.`);
            resolve(false);
        }, 3000);
    });

    // Race the actual init against the timeout
    return Promise.race([initializeInternal(), timeoutPromise]);
  },

  // --- GENERIC CRUD ---

  getAll: async (table: string) => {
    if (!db) return [];
    try {
      const result: any[] = [];
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
      // Fallback query without sorting if schema issues persist
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
      const createdAt = item.createdAt || Date.now();

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
