import { Tasting, Badge, UserProfile, BadgeTier } from "../types";
import { getAbvVal, getPriceVal } from "../utils/helpers";

// Level Thresholds
const LEVEL_THRESHOLDS = [
    { name: 'Curioso', xp: 0 },
    { name: 'Aficionado', xp: 500 },
    { name: 'Entusiasta', xp: 1500 },
    { name: 'Conocedor', xp: 3000 },
    { name: 'Sommelier', xp: 5000 },
    { name: 'Maestro', xp: 10000 },
    { name: 'Leyenda', xp: 20000 }
];

export const calculateXP = (tastings: Tasting[]): number => {
    let totalXP = 0;
    for (const t of tastings) {
        let points = 100; // Base por registrar

        // 1. Multimedia (+50)
        if (t.images && t.images.length > 0) points += 50;

        // 2. Calidad de Contenido (+30)
        if (t.notes && t.notes.length > 50) points += 20;
        if (t.score > 0) points += 10;

        // 3. Completitud Técnica (Aprovechando campos vacíos) (+40)
        // Incentiva rellenar datos que suelen quedar vacíos
        if (t.producer && t.producer.length > 2) points += 10;
        if (t.vintage && t.vintage.length === 4) points += 10;
        if (t.abv && t.abv.length > 0) points += 10;
        if (t.price && t.price.length > 0) points += 10;

        // 4. Perfil Sensorial Completo (+30)
        if (t.visual && t.visual.length > 5 && t.aroma && t.aroma.length > 5 && t.taste && t.taste.length > 5) points += 30;
        
        // 5. Etiquetas (+10)
        if (t.tags && t.tags.length >= 3) points += 10;

        totalXP += points;
    }
    return totalXP;
};

export const getLevelInfo = (xp: number) => {
    let currentLevel = 0;
    let title = LEVEL_THRESHOLDS[0].name;
    let nextThreshold = LEVEL_THRESHOLDS[1].xp;

    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
        if (xp >= LEVEL_THRESHOLDS[i].xp) {
            currentLevel = i + 1;
            title = LEVEL_THRESHOLDS[i].name;
            nextThreshold = LEVEL_THRESHOLDS[i + 1]?.xp || 1000000;
        } else {
            break;
        }
    }
    return { level: currentLevel, title, nextLevelXp: nextThreshold };
};

// --- Helper for Tier Logic ---
type Thresholds = { bronze: number, silver: number, gold: number };

const calculateTier = (value: number, thresholds: Thresholds): { tier: BadgeTier, next: number | null } => {
    if (value >= thresholds.gold) return { tier: 'GOLD', next: null };
    if (value >= thresholds.silver) return { tier: 'SILVER', next: thresholds.gold };
    if (value >= thresholds.bronze) return { tier: 'BRONZE', next: thresholds.silver };
    return { tier: 'LOCKED', next: thresholds.bronze };
};

/**
 * OPTIMIZED CALCULATION: Single Pass Loop O(N)
 * Instead of filtering the array 60+ times, we iterate once and update counters.
 */
export const calculateBadges = (tastings: Tasting[]): Badge[] => {
    // 1. Initialize Counters
    const stats = {
        total: 0,
        photos: 0,
        stock: 0,
        perfect: 0, // >= 9.5
        score10: 0, // == 10
        lowScore: 0, // < 5
        uniqueCountries: new Set<string>(),
        uniqueCategories: new Set<string>(),
        
        // Styles
        wine: 0, beer: 0, spirits: 0, coffee: 0,
        strong: 0, // > 45%
        darkBeer: 0, agave: 0, multicolor: { red: false, white: false, rose: false },
        noble: 0, bubbles: 0, ipa: 0, vermut: 0, zero: 0, relaxed: 0,
        
        // Geo
        italy: 0, japan: 0, france: 0, usa: 0, scotch: 0, 
        hispanic: 0, silk: 0, viking: 0, austral: 0, alpine: 0, caribe: 0, southAm: 0, newWorld: 0,
        euroFlags: { fr: false, es: false, it: false },

        // Profile
        sweet: 0, dryCrisp: 0,
        tags: { wood: 0, natural: 0, fruit: 0, earthy: 0, spicy: 0, tropical: 0 },

        // Quality
        longNotes: 0, perfectFill: 0, pairing: 0, old: 0, analytic: 0, blind: 0, cybog: 0, librarian: 0, visionary: 0,

        // Value & Habits
        bargain: 0, highRoller: 0, totalValue: 0,
        wishlist: 0, night: 0, favs: 0, weekend: 0, breakfast: 0, happy: 0,
        
        // Maps for aggregates
        producers: {} as Record<string, number>,
        days: {} as Record<string, number>,
        months: new Set<string>()
    };

    const currentYear = new Date().getFullYear();

    // 2. Single Pass Loop
    for (const t of tastings) {
        stats.total++;
        if (t.images && t.images.length > 0) stats.photos++;
        if ((t.stock || 0) > 0) stats.stock++;
        if (t.score >= 9.5) stats.perfect++;
        if (t.score === 10) stats.score10++;
        if (t.score > 0 && t.score < 5) stats.lowScore++;
        if (t.country) stats.uniqueCountries.add(t.country);
        if (t.category) stats.uniqueCategories.add(t.category);
        if (t.isWishlist) stats.wishlist++;
        if (t.isFavorite) stats.favs++;
        
        const price = getPriceVal(t.price);
        stats.totalValue += (price * (t.stock || 0));
        if (t.score > 8.5 && price > 0 && price < 20) stats.bargain++;
        if (price > 999) stats.highRoller++;

        const abv = getAbvVal(t.abv);
        if (abv > 45) stats.strong++;
        if (abv > 0 && abv < 10 && t.category !== 'Cerveza') stats.relaxed++;
        if (t.abv && abv < 0.5) stats.zero++;

        // Strings Normalization
        const cat = t.category; // Keep case for direct match, lower for fuzzy
        const catLow = cat.toLowerCase();
        const subLow = (t.subcategory || '').toLowerCase();
        const countryLow = (t.country || '').toLowerCase();
        const varietyLow = (t.variety || '').toLowerCase();
        const allTags = t.tags.join(' ').toLowerCase();

        // Categories
        if (cat === 'Vino') stats.wine++;
        if (cat === 'Cerveza') stats.beer++;
        if (cat === 'Café') stats.coffee++;
        if (['Whisky', 'Ron', 'Gin', 'Tequila', 'Mezcal', 'Brandy'].includes(cat)) stats.spirits++;
        
        // Subcats / Styles
        if (subLow.includes('stout') || subLow.includes('porter') || subLow.includes('black') || subLow.includes('dunkel')) stats.darkBeer++;
        if (catLow.includes('tequila') || catLow.includes('mezcal')) stats.agave++;
        if (subLow.includes('tinto') || subLow.includes('red')) stats.multicolor.red = true;
        if (subLow.includes('blanco') || subLow.includes('white')) stats.multicolor.white = true;
        if (subLow.includes('rosado') || subLow.includes('rose') || subLow.includes('rosé')) stats.multicolor.rose = true;
        if (varietyLow.includes('cabernet') || varietyLow.includes('chardonnay') || varietyLow.includes('pinot noir')) stats.noble++;
        if (subLow.includes('espumoso') || subLow.includes('cava') || subLow.includes('champagne') || subLow.includes('prosecco')) stats.bubbles++;
        if (subLow.includes('ipa')) stats.ipa++;
        if (catLow.includes('vermut') || subLow.includes('vermut')) stats.vermut++;

        // Geography
        if (countryLow.includes('italia') || countryLow.includes('italy')) { stats.italy++; stats.euroFlags.it = true; }
        if (countryLow.includes('japon') || countryLow.includes('japón') || countryLow.includes('japan')) stats.japan++;
        if (countryLow.includes('francia') || countryLow.includes('france')) { stats.france++; stats.euroFlags.fr = true; }
        if (countryLow.includes('españa') || countryLow.includes('spain')) { stats.euroFlags.es = true; stats.hispanic++; }
        if (countryLow.includes('usa') || countryLow.includes('estados unidos')) { stats.usa++; stats.newWorld++; }
        
        if (countryLow.includes('escocia') || countryLow.includes('scotland') || subLow.includes('scotch')) stats.scotch++;
        if (countryLow.includes('chile') || countryLow.includes('argentina')) { stats.hispanic++; stats.southAm++; stats.newWorld++; }
        if (countryLow.includes('uruguay') || countryLow.includes('brasil') || countryLow.includes('brazil') || countryLow.includes('peru') || countryLow.includes('colombia')) stats.southAm++;
        
        if (countryLow.includes('china') || countryLow.includes('india') || countryLow.includes('turqui') || countryLow.includes('turkey')) stats.silk++;
        if (countryLow.includes('suecia') || countryLow.includes('sweden') || countryLow.includes('noruega') || countryLow.includes('norway') || countryLow.includes('finland') || countryLow.includes('dinamarca') || countryLow.includes('islandia')) stats.viking++;
        if (countryLow.includes('australia') || countryLow.includes('zealand')) { stats.austral++; stats.newWorld++; }
        if (countryLow.includes('suiza') || countryLow.includes('switzerland') || countryLow.includes('austria') || countryLow.includes('eslovenia')) stats.alpine++;
        if (countryLow.includes('cuba') || countryLow.includes('jamaica') || countryLow.includes('dominicana') || countryLow.includes('puerto rico') || countryLow.includes('panama')) stats.caribe++;
        if (countryLow.includes('sudafrica') || countryLow.includes('africa')) stats.newWorld++;

        // Profile
        if (t.profile) {
            stats.analytic++;
            if (t.profile.p1 >= 5) stats.sweet++;
            if (t.profile.p1 <= 1 && t.profile.p2 >= 5) stats.dryCrisp++;
        }

        // Tags
        if (allTags.includes('roble') || allTags.includes('madera') || allTags.includes('barrica') || allTags.includes('humo') || allTags.includes('ahumado')) stats.tags.wood++;
        if (allTags.includes('organico') || allTags.includes('natural') || allTags.includes('bio') || allTags.includes('sin sulfitos')) stats.tags.natural++;
        if (allTags.match(/cereza|mora|ciruela|fresa|fruta/)) stats.tags.fruit++;
        if (allTags.match(/tierra|cuero|seta|champi|bosque/)) stats.tags.earthy++;
        if (allTags.match(/pimienta|clavo|canela|nuez|jengibre/)) stats.tags.spicy++;
        if (allTags.match(/piña|mango|coco|maracuya|banana/)) stats.tags.tropical++;

        // Quality
        if (t.notes && t.notes.length > 200) stats.longNotes++;
        if (t.pairing && t.location && t.price && t.producer && t.batch && t.profile) stats.perfectFill++;
        if (t.pairing) stats.pairing++;
        const vintage = parseInt(t.vintage);
        if (!isNaN(vintage) && (currentYear - vintage) > 10) stats.old++;
        if (t.visual && t.visual.length > 5 && t.aroma && t.aroma.length > 5 && t.taste && t.taste.length > 5) stats.blind++;
        if (t.profile && t.tags.length >= 3 && t.notes.length > 50) stats.cybog++;
        if (t.producer && t.abv && t.region && t.price) stats.librarian++;
        if (t.drinkFrom || t.drinkTo) stats.visionary++;

        // Time / Habits
        const d = new Date(t.createdAt);
        const h = d.getHours();
        const day = d.getDay();
        if (h >= 22 || h < 4) stats.night++;
        if (h < 10) stats.breakfast++;
        if (h >= 18 && h <= 20) stats.happy++;
        if (day === 0 || day === 5 || day === 6) stats.weekend++;
        
        const dateStr = d.toLocaleDateString();
        stats.days[dateStr] = (stats.days[dateStr] || 0) + 1;
        stats.months.add(`${d.getMonth()}-${d.getFullYear()}`);
        
        if (t.producer) stats.producers[t.producer] = (stats.producers[t.producer] || 0) + 1;
    }

    // 3. Computed Aggregates
    const countMulticolor = (stats.multicolor.red ? 1 : 0) + (stats.multicolor.white ? 1 : 0) + (stats.multicolor.rose ? 1 : 0);
    const countEuro = (stats.euroFlags.fr ? 1 : 0) + (stats.euroFlags.es ? 1 : 0) + (stats.euroFlags.it ? 1 : 0);
    const maxProducerCount = Math.max(...Object.values(stats.producers), 0);
    const maxMarathon = Math.max(...Object.values(stats.days), 0);


    // --- DEFINE ALL 66 BADGES (MAPPED) ---
    const definitions = [
        // --- 🏆 GENERAL ---
        { id: 'novice', name: 'Primer Sorbo', description: 'Comienza tu viaje.', icon: 'emoji_food_beverage', color: '#60a5fa', category: '🏆 General', value: stats.total, thresholds: { bronze: 1, silver: 5, gold: 20 } },
        { id: 'critic', name: 'Crítico Experto', description: 'Total de catas.', icon: 'rate_review', color: '#f59e0b', category: '🏆 General', value: stats.total, thresholds: { bronze: 10, silver: 50, gold: 100 } },
        { id: 'photographer', name: 'Fotógrafo', description: 'Catas con foto.', icon: 'camera_alt', color: '#a855f7', category: '🏆 General', value: stats.photos, thresholds: { bronze: 5, silver: 20, gold: 50 } },
        { id: 'traveler', name: 'Trotamundos', description: 'Países explorados.', icon: 'public', color: '#10b981', category: '🏆 General', value: stats.uniqueCountries.size, thresholds: { bronze: 3, silver: 10, gold: 20 } },
        { id: 'collector', name: 'Coleccionista', description: 'Botellas en stock.', icon: 'inventory_2', color: '#f43f5e', category: '🏆 General', value: stats.stock, thresholds: { bronze: 10, silver: 50, gold: 100 } },
        { id: 'gourmet', name: 'Sibarita', description: 'Puntuación 9.5+.', icon: 'diamond', color: '#06b6d4', category: '🏆 General', value: stats.perfect, thresholds: { bronze: 1, silver: 5, gold: 10 } },
        { id: 'explorer', name: 'Enciclopedia', description: 'Categorías probadas.', icon: 'school', color: '#8b5cf6', category: '🏆 General', value: stats.uniqueCategories.size, thresholds: { bronze: 3, silver: 5, gold: 8 } },

        // --- 🤖 TECNOLOGÍA & FUNCIÓN ---
        { id: 'cyborg', name: 'Cyborg', description: 'Fichas detalladas (IA Style).', icon: 'smart_toy', color: '#ec4899', category: '🤖 Tecnología', value: stats.cybog, thresholds: { bronze: 5, silver: 20, gold: 50 } },
        { id: 'librarian', name: 'Bibliotecario', description: 'Datos técnicos completos.', icon: 'auto_stories', color: '#fbbf24', category: '🤖 Tecnología', value: stats.librarian, thresholds: { bronze: 5, silver: 20, gold: 50 } },
        { id: 'judge', name: 'Crítico Duro', description: 'Puntuaciones bajas (<5).', icon: 'gavel', color: '#94a3b8', category: '🤖 Tecnología', value: stats.lowScore, thresholds: { bronze: 1, silver: 5, gold: 10 } },
        { id: 'visionary', name: 'Visionario', description: 'Ventana de consumo definida.', icon: 'visibility', color: '#8b5cf6', category: '🤖 Tecnología', value: stats.visionary, thresholds: { bronze: 3, silver: 10, gold: 30 } },
        { id: 'blindmaster', name: 'Ciego de Amor', description: 'Notas sensoriales completas.', icon: 'visibility_off', color: '#f472b6', category: '🤖 Tecnología', value: stats.blind, thresholds: { bronze: 1, silver: 5, gold: 15 } },

        // --- 🍷 ESTILOS ---
        { id: 'vigneron', name: 'Vigneron', description: 'Amante del Vino.', icon: 'wine_bar', color: '#ef4444', category: '🍷 Estilos', value: stats.wine, thresholds: { bronze: 10, silver: 50, gold: 100 } },
        { id: 'brewer', name: 'Maestro Cervecero', description: 'Amante de la Cerveza.', icon: 'sports_bar', color: '#eab308', category: '🍷 Estilos', value: stats.beer, thresholds: { bronze: 10, silver: 50, gold: 100 } },
        { id: 'spirits', name: 'Espíritu Libre', description: 'Destilados.', icon: 'liquor', color: '#f97316', category: '🍷 Estilos', value: stats.spirits, thresholds: { bronze: 5, silver: 20, gold: 50 } },
        { id: 'barista', name: 'Barista', description: 'Experto en Café.', icon: 'coffee', color: '#78350f', category: '🍷 Estilos', value: stats.coffee, thresholds: { bronze: 5, silver: 20, gold: 50 } },
        { id: 'firethroat', name: 'Garganta de Fuego', description: 'ABV > 45%.', icon: 'local_fire_department', color: '#dc2626', category: '🍷 Estilos', value: stats.strong, thresholds: { bronze: 3, silver: 10, gold: 20 } },
        { id: 'darkside', name: 'Lado Oscuro', description: 'Stout / Porter.', icon: 'dark_mode', color: '#3f3f46', category: '🍷 Estilos', value: stats.darkBeer, thresholds: { bronze: 3, silver: 10, gold: 30 } },
        { id: 'charro', name: 'El Charro', description: 'Tequila / Mezcal.', icon: 'grass', color: '#15803d', category: '🍷 Estilos', value: stats.agave, thresholds: { bronze: 3, silver: 10, gold: 30 } },
        { id: 'multicolor', name: 'Multicolor', description: 'Tinto, Blanco, Rosado.', icon: 'palette', color: '#c084fc', category: '🍷 Estilos', value: countMulticolor, thresholds: { bronze: 1, silver: 2, gold: 3 } },
        { id: 'noble', name: 'Alma Noble', description: 'Cab/Chard/Pinot.', icon: 'stars', color: '#6366f1', category: '🍷 Estilos', value: stats.noble, thresholds: { bronze: 3, silver: 10, gold: 30 } },
        { id: 'bubbles', name: 'Burbujas', description: 'Espumosos / Champagne.', icon: 'celebration', color: '#fcd34d', category: '🍷 Estilos', value: stats.bubbles, thresholds: { bronze: 3, silver: 10, gold: 25 } },
        { id: 'hophead', name: 'Hop Head', description: 'Amante de las IPA.', icon: 'local_florist', color: '#16a34a', category: '🍷 Estilos', value: stats.ipa, thresholds: { bronze: 3, silver: 10, gold: 25 } },
        { id: 'vermut', name: 'Hora del Vermut', description: 'Aperitivos.', icon: 'local_bar', color: '#b91c1c', category: '🍷 Estilos', value: stats.vermut, thresholds: { bronze: 3, silver: 10, gold: 20 } },
        { id: 'zero', name: 'Zero Hero', description: 'Sin Alcohol.', icon: 'water_drop', color: '#06b6d4', category: '🍷 Estilos', value: stats.zero, thresholds: { bronze: 1, silver: 5, gold: 10 } },
        { id: 'relaxed', name: 'Relajado', description: 'Baja graduación (<10% no cerveza).', icon: 'spa', color: '#7dd3fc', category: '🍷 Estilos', value: stats.relaxed, thresholds: { bronze: 3, silver: 10, gold: 25 } },

        // --- 🌍 EXPLORACIÓN ---
        { id: 'dolcevita', name: 'La Dolce Vita', description: 'Italia.', icon: 'local_pizza', color: '#16a34a', category: '🌍 Exploración', value: stats.italy, thresholds: { bronze: 3, silver: 10, gold: 25 } },
        { id: 'samurai', name: 'Samurái', description: 'Japón.', icon: 'ramen_dining', color: '#ef4444', category: '🌍 Exploración', value: stats.japan, thresholds: { bronze: 3, silver: 10, gold: 25 } },
        { id: 'eurotrip', name: 'Eurotrip', description: 'FR + ES + IT.', icon: 'euro', color: '#3b82f6', category: '🌍 Exploración', value: countEuro, thresholds: { bronze: 1, silver: 2, gold: 3 } },
        { id: 'french', name: 'Afrancesado', description: 'Vinos de Francia.', icon: 'flight', color: '#3b82f6', category: '🌍 Exploración', value: stats.france, thresholds: { bronze: 3, silver: 10, gold: 25 } },
        { id: 'conquistador', name: 'Conquistador', description: 'Mundo Hispano.', icon: 'explore', color: '#dc2626', category: '🌍 Exploración', value: stats.hispanic, thresholds: { bronze: 5, silver: 15, gold: 40 } },
        { id: 'highlander', name: 'Highlander', description: 'Whisky Escocés.', icon: 'castle', color: '#1e40af', category: '🌍 Exploración', value: stats.scotch, thresholds: { bronze: 3, silver: 10, gold: 25 } },
        { id: 'gringo', name: 'Gringo', description: 'Estados Unidos.', icon: 'flag', color: '#ef4444', category: '🌍 Exploración', value: stats.usa, thresholds: { bronze: 3, silver: 10, gold: 25 } },
        { id: 'silkroad', name: 'Ruta de la Seda', description: 'Asia y Oriente.', icon: 'temple_buddhist', color: '#ef4444', category: '🌍 Exploración', value: stats.silk, thresholds: { bronze: 1, silver: 5, gold: 10 } },
        { id: 'viking', name: 'Vikingo', description: 'Escandinavia.', icon: 'sailing', color: '#0ea5e9', category: '🌍 Exploración', value: stats.viking, thresholds: { bronze: 1, silver: 3, gold: 10 } },
        { id: 'austral', name: 'Austral', description: 'Australia / NZ.', icon: 'surfing', color: '#facc15', category: '🌍 Exploración', value: stats.austral, thresholds: { bronze: 3, silver: 10, gold: 25 } },
        { id: 'alpine', name: 'Alpino', description: 'Alpes (CH, AT, SI).', icon: 'hiking', color: '#f1f5f9', category: '🌍 Exploración', value: stats.alpine, thresholds: { bronze: 1, silver: 5, gold: 15 } },
        { id: 'caribe', name: 'Caribeño', description: 'Caribe y Centroamérica.', icon: 'beach_access', color: '#06b6d4', category: '🌍 Exploración', value: stats.caribe, thresholds: { bronze: 3, silver: 10, gold: 25 } },
        { id: 'latino', name: 'Sudamericano', description: 'América del Sur.', icon: 'south_america', color: '#f97316', category: '🌍 Exploración', value: stats.southAm, thresholds: { bronze: 5, silver: 15, gold: 30 } },
        { id: 'newworld', name: 'Nuevo Mundo', description: 'USA, Sur, AU, ZA.', icon: 'public_off', color: '#8b5cf6', category: '🌍 Exploración', value: stats.newWorld, thresholds: { bronze: 5, silver: 20, gold: 50 } },

        // --- 👅 PERFIL SENSORIAL ---
        { id: 'goloso', name: 'Goloso', description: 'Muy dulce.', icon: 'icecream', color: '#f472b6', category: '👅 Perfil Sensorial', value: stats.sweet, thresholds: { bronze: 3, silver: 10, gold: 20 } },
        { id: 'drycrisp', name: 'Seco & Cortante', description: 'Seco y Ácido.', icon: 'content_cut', color: '#facc15', category: '👅 Perfil Sensorial', value: stats.dryCrisp, thresholds: { bronze: 3, silver: 10, gold: 20 } },
        { id: 'woodsmoke', name: 'Roble y Humo', description: 'Madera / Ahumado.', icon: 'fireplace', color: '#b45309', category: '👅 Perfil Sensorial', value: stats.tags.wood, thresholds: { bronze: 5, silver: 20, gold: 50 } },
        { id: 'naturalist', name: 'Naturista', description: 'Orgánico / Bio.', icon: 'eco', color: '#84cc16', category: '👅 Perfil Sensorial', value: stats.tags.natural, thresholds: { bronze: 1, silver: 5, gold: 15 } },
        { id: 'fruitbomb', name: 'Frutibomba', description: 'Mucha fruta.', icon: 'nutrition', color: '#be185d', category: '👅 Perfil Sensorial', value: stats.tags.fruit, thresholds: { bronze: 5, silver: 15, gold: 40 } },
        { id: 'earthy', name: 'Terroso', description: 'Tierra / Cuero.', icon: 'forest', color: '#78350f', category: '👅 Perfil Sensorial', value: stats.tags.earthy, thresholds: { bronze: 3, silver: 10, gold: 25 } },
        { id: 'spicy', name: 'Especiado', description: 'Especias.', icon: 'whatshot', color: '#ea580c', category: '👅 Perfil Sensorial', value: stats.tags.spicy, thresholds: { bronze: 3, silver: 10, gold: 25 } },
        { id: 'tropical', name: 'Tropical', description: 'Piña / Mango.', icon: 'wb_sunny', color: '#facc15', category: '👅 Perfil Sensorial', value: stats.tags.tropical, thresholds: { bronze: 3, silver: 10, gold: 25 } },

        // --- 📝 CALIDAD ---
        { id: 'chronicler', name: 'El Cronista', description: 'Notas largas.', icon: 'history_edu', color: '#8b5cf6', category: '📝 Calidad', value: stats.longNotes, thresholds: { bronze: 1, silver: 5, gold: 20 } },
        { id: 'perfectionist', name: 'Perfeccionista', description: 'Ficha completa.', icon: 'verified', color: '#06b6d4', category: '📝 Calidad', value: stats.perfectFill, thresholds: { bronze: 1, silver: 5, gold: 20 } },
        { id: 'chef', name: 'Chef de Maridaje', description: 'Maridajes.', icon: 'restaurant_menu', color: '#10b981', category: '📝 Calidad', value: stats.pairing, thresholds: { bronze: 5, silver: 20, gold: 50 } },
        { id: 'archeologist', name: 'Arqueólogo', description: 'Añadas > 10 años.', icon: 'museum', color: '#b45309', category: '📝 Calidad', value: stats.old, thresholds: { bronze: 1, silver: 3, gold: 10 } },
        { id: 'analytic', name: 'Analítico', description: 'Radar completado.', icon: 'analytics', color: '#0ea5e9', category: '📝 Calidad', value: stats.analytic, thresholds: { bronze: 5, silver: 20, gold: 50 } },
        { id: 'unicorn', name: 'Unicornio', description: '10/10 Perfecto.', icon: 'auto_awesome', color: '#d8b4fe', category: '📝 Calidad', value: stats.score10, thresholds: { bronze: 1, silver: 3, gold: 5 } },

        // --- 💰 VALOR ---
        { id: 'bargain', name: 'Cazagangas', description: 'Bueno y barato.', icon: 'sell', color: '#22c55e', category: '💰 Valor', value: stats.bargain, thresholds: { bronze: 1, silver: 5, gold: 20 } },
        { id: 'highroller', name: 'High Roller', description: 'Precio > 999.', icon: 'monetization_on', color: '#fcd34d', category: '💰 Valor', value: stats.highRoller, thresholds: { bronze: 1, silver: 3, gold: 10 } },
        { id: 'investor', name: 'Inversionista', description: 'Bodega > 1000.', icon: 'savings', color: '#22c55e', category: '💰 Valor', value: stats.totalValue, thresholds: { bronze: 1000, silver: 5000, gold: 10000 } },

        // --- 📅 HÁBITOS ---
        { id: 'fanatic', name: 'Fanático', description: 'Lealtad productor.', icon: 'loyalty', color: '#ec4899', category: '📅 Hábitos', value: maxProducerCount, thresholds: { bronze: 3, silver: 5, gold: 10 } },
        { id: 'dreamer', name: 'Soñador', description: 'Wishlist.', icon: 'cloud', color: '#6366f1', category: '📅 Hábitos', value: stats.wishlist, thresholds: { bronze: 5, silver: 10, gold: 20 } },
        { id: 'nocturnal', name: 'Nocturno', description: 'Cata 22h-04h.', icon: 'dark_mode', color: '#312e81', category: '📅 Hábitos', value: stats.night, thresholds: { bronze: 1, silver: 5, gold: 10 } },
        { id: 'goldheart', name: 'Corazón de Oro', description: 'Favoritos.', icon: 'favorite', color: '#ef4444', category: '📅 Hábitos', value: stats.favs, thresholds: { bronze: 10, silver: 25, gold: 50 } },
        { id: 'weekend', name: 'Fin de Semana', description: 'Vie-Dom.', icon: 'weekend', color: '#f97316', category: '📅 Hábitos', value: stats.weekend, thresholds: { bronze: 5, silver: 20, gold: 50 } },
        { id: 'breakfast', name: 'Desayuno', description: 'Antes 10AM.', icon: 'bakery_dining', color: '#d97706', category: '📅 Hábitos', value: stats.breakfast, thresholds: { bronze: 1, silver: 5, gold: 10 } },
        { id: 'happyhour', name: 'Happy Hour', description: '18h-20h.', icon: 'nightlife', color: '#f59e0b', category: '📅 Hábitos', value: stats.happy, thresholds: { bronze: 5, silver: 15, gold: 40 } },
        { id: 'marathon', name: 'Maratonista', description: '3+ en un día.', icon: 'directions_run', color: '#3b82f6', category: '📅 Hábitos', value: maxMarathon, thresholds: { bronze: 3, silver: 5, gold: 10 } },
        { id: 'loyal', name: 'Fiel', description: '3 meses activos.', icon: 'pets', color: '#10b981', category: '📅 Hábitos', value: stats.months.size, thresholds: { bronze: 3, silver: 6, gold: 12 } }
    ];

    return definitions.map(def => {
        const { tier, next } = calculateTier(def.value, def.thresholds);
        return {
            id: def.id,
            name: def.name,
            description: def.description,
            icon: def.icon,
            color: def.color,
            category: def.category,
            tier: tier,
            currentValue: def.value,
            nextThreshold: next
        };
    });
};

export const getUserProfile = (tastings: Tasting[]): UserProfile => {
    const xp = calculateXP(tastings);
    const { level, title, nextLevelXp } = getLevelInfo(xp);
    const badges = calculateBadges(tastings);

    return { level, title, xp, nextLevelXp, badges };
};