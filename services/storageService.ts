
import { Tasting, Category, DEFAULT_CATEGORIES, UserList } from '../types';
import { get, set, del, keys } from 'idb-keyval'; // Mantener para migración y fallback
import { sqliteService } from './sqliteService';

const TASTINGS_KEY = 'katalist_tastings';
const IMAGES_KEY = 'katalist_images'; 
const CATEGORIES_KEY = 'katalist_categories';
const LISTS_KEY = 'katalist_lists';
const SHARED_FILE_KEY = 'katalist_shared_file';
const MIGRATION_KEY = 'katalist_sqlite_migrated';

// Mode Flag: Determines if we use SQLite or fallback to IDB
let USE_SQLITE = false;

// Helper to generate a small thumbnail from base64
const generateThumbnail = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 100; // Small thumbnail size
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
      } else {
        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.5)); 
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
  });
};

export const storageService = {
  // Initialize: Try SQLite, if fails, stay on IDB. If SQLite works, check migration.
  init: async (): Promise<void> => {
    try {
      // 1. Try to init SQLite
      // sqliteService.init now returns FALSE if OPFS is not available or times out, preventing data loss or freeze
      const sqliteReady = await sqliteService.init();
      
      if (sqliteReady) {
          USE_SQLITE = true;
          console.log("Storage: Using SQLite Backend (High Performance)");
          
          // 2. Check if migration is needed (User has data in IDB but not in SQLite)
          const alreadyMigrated = localStorage.getItem(MIGRATION_KEY);
          if (!alreadyMigrated) {
              const legacyTastings = await get<Tasting[]>(TASTINGS_KEY);
              if (legacyTastings && legacyTastings.length > 0) {
                  console.log("Storage: Migrating data to SQLite...");
                  await storageService.migrateToSqlite(legacyTastings);
                  localStorage.setItem(MIGRATION_KEY, 'true');
              }
          }
      } else {
          console.warn("Storage: SQLite Init Failed or OPFS missing. Falling back to IndexedDB (Legacy).");
          USE_SQLITE = false;
      }

      // 3. Ensure defaults exist (Categories)
      const cats = await storageService.getCategories();
      if (cats.length === 0) {
          await storageService.saveCategories(DEFAULT_CATEGORIES);
      } else {
          // Sync missing defaults logic
          let catsChanged = false;
          for (const def of DEFAULT_CATEGORIES) {
              const exists = cats.find(c => c.name === def.name);
              if (!exists) {
                  cats.push(def);
                  catsChanged = true;
              } else {
                  if (def.name === 'Brandy' && def.icon === 'castle' && exists.icon !== 'castle') {
                       exists.icon = 'castle';
                       catsChanged = true;
                  }
              }
          }
          if (catsChanged) await storageService.saveCategories(cats);
      }

    } catch (e) {
      console.error("Error initializing DB", e);
      USE_SQLITE = false; // Fallback on error
    }
  },

  // --- MIGRATION LOGIC ---
  migrateToSqlite: async (legacyTastings: Tasting[]) => {
      // 1. Tastings
      await sqliteService.saveBulk('tastings', legacyTastings);
      
      // 2. Categories
      const legacyCats = await get<Category[]>(CATEGORIES_KEY) || [];
      if (legacyCats.length > 0) await sqliteService.saveBulk('categories', legacyCats);
      
      // 3. Lists
      const legacyLists = await get<UserList[]>(LISTS_KEY) || [];
      if (legacyLists.length > 0) await sqliteService.saveBulk('lists', legacyLists);

      // 4. Images (Heavy part)
      const allKeys = await keys();
      const imageKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(IMAGES_KEY));
      const imagesToMigrate: {id: string, data: string}[] = [];
      
      for (const k of imageKeys) {
          const val = await get<string>(k);
          if (val) {
              const id = (k as string).replace(`${IMAGES_KEY}_`, '');
              imagesToMigrate.push({ id, data: val });
          }
      }
      
      if (imagesToMigrate.length > 0) {
          console.log(`Migrating ${imagesToMigrate.length} images...`);
          await sqliteService.saveImagesBulk(imagesToMigrate);
      }
      console.log("Migration Complete.");
  },

  // --- CRUD METHODS ---

  getTastings: async (): Promise<Tasting[]> => {
    try {
      if (USE_SQLITE) {
          return await sqliteService.getAll('tastings');
      } else {
          const data = await get<Tasting[]>(TASTINGS_KEY);
          return (data || []).sort((a, b) => b.createdAt - a.createdAt);
      }
    } catch (e) {
      console.error('Error reading tastings', e);
      return [];
    }
  },

  getImage: async (imageId: string): Promise<string | undefined> => {
      if (!imageId) return undefined;
      if (imageId.startsWith('data:image')) return imageId; // Legacy/Transient fallback

      if (USE_SQLITE) {
          return await sqliteService.getImage(imageId);
      } else {
          return await get<string>(`${IMAGES_KEY}_${imageId}`);
      }
  },

  saveTasting: async (tasting: Tasting): Promise<void> => {
    try {
      // Process images: Extract Base64 -> Save to Store -> Replace with ID
      const processedImages: string[] = [];
      let thumbnail = tasting.thumbnail;

      for (const img of tasting.images) {
          if (img.startsWith('data:image')) {
              // New image logic
              const imgId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              
              if (USE_SQLITE) {
                  await sqliteService.saveImage(imgId, img);
              } else {
                  await set(`${IMAGES_KEY}_${imgId}`, img);
              }
              
              processedImages.push(imgId);

              if (!thumbnail && processedImages.length === 1) {
                  thumbnail = await generateThumbnail(img);
              }
          } else {
              processedImages.push(img);
          }
      }

      const lightTasting: Tasting = {
          ...tasting,
          images: processedImages,
          thumbnail: thumbnail
      };

      if (USE_SQLITE) {
          await sqliteService.save('tastings', lightTasting);
      } else {
          const tastings = (await get<Tasting[]>(TASTINGS_KEY)) || [];
          const index = tastings.findIndex((t) => t.id === tasting.id);
          if (index >= 0) tastings[index] = lightTasting;
          else tastings.unshift(lightTasting);
          await set(TASTINGS_KEY, tastings);
      }

    } catch (e) {
      console.error("Error saving tasting", e);
      throw new Error("Error guardando datos.");
    }
  },
  
  saveTastingsBulk: async (tastingsToSave: Tasting[]): Promise<void> => {
      if (USE_SQLITE) {
          await sqliteService.saveBulk('tastings', tastingsToSave);
      } else {
          // Legacy Bulk
          const currentTastings = await get<Tasting[]>(TASTINGS_KEY) || [];
          const map = new Map<string, Tasting>();
          currentTastings.forEach(t => map.set(t.id, t));
          for (const t of tastingsToSave) map.set(t.id, t);
          const updatedList = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
          await set(TASTINGS_KEY, updatedList);
      }
  },

  deleteTasting: async (id: string): Promise<void> => {
    try {
        // We get the tasting first to clean up images
        let toDelete: Tasting | undefined;
        if (USE_SQLITE) {
            toDelete = await sqliteService.getById('tastings', id);
        } else {
            const tastings = await get<Tasting[]>(TASTINGS_KEY) || [];
            toDelete = tastings.find(t => t.id === id);
        }

        // Clean images
        if (toDelete && toDelete.images) {
            for (const imgId of toDelete.images) {
                if (!imgId.startsWith('data:image')) {
                   if (USE_SQLITE) {
                       await sqliteService.delete('images', imgId);
                   } else {
                       await del(`${IMAGES_KEY}_${imgId}`);
                   }
                }
            }
        }

        if (USE_SQLITE) {
            await sqliteService.delete('tastings', id);
        } else {
            const tastings = await get<Tasting[]>(TASTINGS_KEY) || [];
            const filtered = tastings.filter((t) => t.id !== id);
            await set(TASTINGS_KEY, filtered);
        }
        
        // Remove from lists
        const lists = await storageService.getLists();
        let listUpdated = false;
        const newLists = lists.map(l => {
             if (l.itemIds.includes(id)) {
                 listUpdated = true;
                 return { ...l, itemIds: l.itemIds.filter(itemId => itemId !== id) };
             }
             return l;
        });
        if (listUpdated) await storageService.saveLists(newLists);

    } catch(e) {
        console.error("Error deleting tasting", e);
        throw e;
    }
  },

  getCategories: async (): Promise<Category[]> => {
    try {
      if (USE_SQLITE) {
          const res = await sqliteService.getAll('categories');
          return res.length > 0 ? res : DEFAULT_CATEGORIES;
      } else {
          const data = await get<Category[]>(CATEGORIES_KEY);
          return data || DEFAULT_CATEGORIES;
      }
    } catch (e) {
      return DEFAULT_CATEGORIES;
    }
  },

  saveCategories: async (categories: Category[]): Promise<void> => {
    if (USE_SQLITE) {
        await sqliteService.saveBulk('categories', categories);
    } else {
        await set(CATEGORIES_KEY, categories);
    }
  },
  
  getLists: async (): Promise<UserList[]> => {
      try {
          if (USE_SQLITE) return await sqliteService.getAll('lists');
          const data = await get<UserList[]>(LISTS_KEY);
          return data || [];
      } catch (e) { return []; }
  },
  
  saveLists: async (lists: UserList[]): Promise<void> => {
      if (USE_SQLITE) await sqliteService.saveBulk('lists', lists);
      else await set(LISTS_KEY, lists);
  },

  // --- EXPORT / IMPORT ---
  exportData: async (includeImages: boolean = true): Promise<string> => {
    const tastings = await storageService.getTastings();
    
    let exportedTastings = tastings;

    if (includeImages) {
        exportedTastings = await Promise.all(tastings.map(async t => {
            const fullImages = await Promise.all(t.images.map(id => storageService.getImage(id)));
            return {
                ...t,
                images: fullImages.filter(Boolean) as string[]
            };
        }));
    } else {
        exportedTastings = tastings.map(t => ({
            ...t,
            images: [],
            thumbnail: undefined
        }));
    }
    
    const categories = await storageService.getCategories();
    const lists = await storageService.getLists();
    
    const data = {
      tastings: exportedTastings,
      categories,
      lists,
      exportedAt: new Date().toISOString(),
      version: '21.07',
      type: includeImages ? 'FULL' : 'TEXT_ONLY'
    };
    return JSON.stringify(data, null, 2);
  },

  exportToCSV: async (): Promise<string> => {
    const tastings = await storageService.getTastings();
    const lists = await storageService.getLists();
    
    const headers = [
      "Nombre", "Productor", "Variedad", "Etiqueta", "Lote", 
      "Categoría", "Subcategoría", "País", "Región", "Lugar Compra",
      "Añada", "ABV", "Precio", "Stock", "Puntuación", "Favorito", 
      "Notas", "Maridaje", "Fecha Registro", "Beber Desde", "Beber Hasta", "Listas"
    ];

    const escape = (text: string | number | undefined | boolean) => {
      if (text === undefined || text === null) return '""';
      const str = String(text).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = tastings.map(t => {
      const memberOf = lists.filter(l => l.itemIds.includes(t.id)).map(l => l.name).join(' | ');
      return [
        t.name, t.producer, t.variety, t.label, t.batch, 
        t.category, t.subcategory, t.country, t.region, t.location,
        t.vintage, t.abv, t.price, t.stock, t.score, t.isFavorite ? "Si" : "No", 
        t.notes, t.pairing, new Date(t.createdAt).toLocaleDateString(), t.drinkFrom, t.drinkTo, memberOf
      ].map(escape).join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  },

  importData: async (jsonString: string): Promise<boolean> => {
    try {
      const data = JSON.parse(jsonString);
      if (data.tastings && Array.isArray(data.tastings)) {
        for (const t of data.tastings) {
             let images = t.images;
             if (!images && t.imageBase64) images = [t.imageBase64];
             
             await storageService.saveTasting({
                 ...t,
                 images: images || []
             });
        }
      }
      if (data.categories && Array.isArray(data.categories)) {
        await storageService.saveCategories(data.categories);
      }
      if (data.lists && Array.isArray(data.lists)) {
          await storageService.saveLists(data.lists);
      }
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  },

  getSharedFile: async (): Promise<File | null> => {
      try {
          const file = await get(SHARED_FILE_KEY);
          if (file) {
              await del(SHARED_FILE_KEY);
              return file as File;
          }
          return null;
      } catch (e) {
          console.error("Error getting shared file", e);
          return null;
      }
  }
};