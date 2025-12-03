

export interface Category {
  id: string;
  name: string;
  subcategories: string[];
  color?: string; // Hex color code
  icon?: string; // Material symbol name or Emoji
}

// New Interface for Radar Chart Data
// Keys p1-p5 are generic to map dynamically based on category
export interface FlavorProfile {
  p1: number; // e.g. Dulzor
  p2: number; // e.g. Acidez
  p3: number; // e.g. Taninos
  p4: number; // e.g. Cuerpo
  p5: number; // e.g. Alcohol
}

export interface Tasting {
  id: string;
  name: string;
  producer?: string; // Nuevo: Bodega / Marca
  variety?: string;  // Nuevo: Uva / Materia Prima
  label?: string; 
  batch?: string; 
  category: string;
  subcategory: string;
  country: string;
  region: string;
  location?: string; // Nuevo: Lugar de compra / consumo
  abv: string; 
  vintage: string;
  drinkFrom?: string; // Year start (Guarda)
  drinkTo?: string;   // Year end (Guarda) 
  price: string;
  score: number; // 1-10
  isFavorite: boolean;
  isWishlist?: boolean; // Nuevo: Lista de deseos / Por comprar
  stock?: number; // Nuevo: Cantidad en bodega
  openDate?: number; // New: Timestamp when bottle was opened
  visual: string; 
  aroma: string;
  taste: string;
  pairing?: string; // Nuevo: Maridaje sugerido o realizado
  notes: string; 
  images: string[]; // Now contains IDs referencing the image store, or Base64 transiently
  thumbnail?: string; // Tiny Base64 for list views
  tags: string[];
  profile?: FlavorProfile; // Optional numerical profile
  createdAt: number;
  updatedAt: number;
}

export interface UserList {
    id: string;
    name: string;
    itemIds: string[];
    createdAt: number;
}

// --- Gamification Types ---
export type BadgeTier = 'LOCKED' | 'BRONZE' | 'SILVER' | 'GOLD';

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    tier: BadgeTier; // Calculated status
    currentValue: number; // e.g. 5 countries
    nextThreshold: number | null; // e.g. 10 countries (null if maxed)
    category?: string; // e.g. '🏆 General', '🌍 Exploración'
}

export interface UserProfile {
    level: number;
    title: string;
    xp: number;
    nextLevelXp: number;
    badges: Badge[];
}

// --- Cloud Types ---
export interface CloudFile {
    id: string;
    name: string;
    modifiedTime: string;
}

export type ViewState = 'DASHBOARD' | 'NEW' | 'SEARCH' | 'FAVORITES' | 'CATEGORIES' | 'DETAIL' | 'AI_CHAT' | 'GUIDED' | 'COMPARE' | 'INSIGHTS' | 'PROFILE' | 'CHEF' | 'BLIND' | 'MERGE' | 'MAP' | 'MIXOLOGY';

// Defaults with Icons
export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Vino', subcategories: ['Tinto', 'Blanco', 'Rosado', 'Espumoso'], color: '#a855f7', icon: 'wine_bar' }, 
  { id: '2', name: 'Cerveza', subcategories: ['IPA', 'Lager', 'Stout', 'Porter', 'Sour'], color: '#eab308', icon: 'sports_bar' }, 
  { id: '3', name: 'Whisky', subcategories: ['Single Malt', 'Blended', 'Bourbon', 'Rye'], color: '#f59e0b', icon: 'local_bar' }, 
  { id: '4', name: 'Ron', subcategories: ['Blanco', 'Dorado', 'Añejo', 'Spiced'], color: '#dc2626', icon: 'liquor' },
  { id: '5', name: 'Gin', subcategories: ['London Dry', 'Old Tom', 'Plymouth', 'New Western'], color: '#22d3ee', icon: 'local_drink' },
  { id: '6', name: 'Tequila', subcategories: ['Blanco', 'Reposado', 'Añejo', 'Cristalino'], color: '#84cc16', icon: 'grass' },
  { id: '7', name: 'Mezcal', subcategories: ['Espadín', 'Tobalá', 'Tepeztate', 'Ensamble'], color: '#15803d', icon: 'local_fire_department' },
  { id: '8', name: 'Brandy', subcategories: ['Cognac', 'Armagnac', 'Jerez', 'Pisco'], color: '#c2410c', icon: 'castle' }, 
  { id: '9', name: 'Café', subcategories: ['Espresso', 'Filtrado', 'Cold Brew'], color: '#78350f', icon: 'coffee' }, 
  { id: '10', name: 'Vodka', subcategories: ['Neutro', 'Aromatizado', 'Trigo', 'Centeno', 'Patata'], color: '#94a3b8', icon: 'water_drop' },
];