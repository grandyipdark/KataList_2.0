import { FLAVOR_WHEEL_DATA } from './flavorWheelData';

export interface FlavorGroup {
    group: string;
    tags: string[];
}

export const FLAVOR_DATA: Record<string, FlavorGroup[]> = {
    'Vino': [
        { group: 'Fruta Roja', tags: ['🍒 Cereza', '🍓 Fresa', 'Frambuesa', 'Grosella Roja', 'Granada', 'Arándano Rojo'] },
        { group: 'Fruta Negra', tags: ['🫐 Mora', 'Ciruela Negra', 'Cassis', 'Arándano', 'Higo'] },
        { group: 'Cítrico/Tropical', tags: ['🍋 Limón', '🍊 Pomelo', 'Lima', '🍍 Piña', '🍑 Melocotón', '🍈 Melón', 'Maracuyá'] },
        { group: 'Floral/Hierbas', tags: ['🌸 Violeta', '🌹 Rosa', 'Jazmín', '🌿 Menta', 'Eucalipto', 'Pimiento Verde', 'Hierba Cortada'] },
        { group: 'Crianza/Roble', tags: ['🪵 Madera', '🍦 Vainilla', 'Coco', '🍫 Chocolate', 'Café', '🍞 Tostado', '🔥 Humo', 'Tabaco', 'Cuero'] },
        { group: 'Tierra/Mineral', tags: ['🍄 Champiñón', 'Tierra Húmeda', '🪨 Piedra', 'Tiza', 'Grafito', 'Petróleo'] }
    ],
    'Cerveza': [
        { group: 'Malta', tags: ['🍞 Pan', 'Galleta', 'Caramelo', 'Toffee', '🍫 Chocolate', 'Café', 'Cereal', 'Nuez'] },
        { group: 'Lúpulo', tags: ['🍋 Cítrico', '🌲 Pino', 'Resina', '💐 Floral', 'Tierra', 'Hierba', '🍍 Fruta Tropical'] },
        { group: 'Fermentación', tags: ['🍌 Banana', 'Clavo', 'Pimienta', '🍏 Manzana Verde', 'Pera', 'Funky/Cuero', 'Acido'] },
        { group: 'Sensación', tags: ['Amargo', 'Dulce', 'Seco', 'Cremoso', 'Gasificado', 'Astringente'] }
    ],
    'Café': [
        { group: 'Frutal', tags: ['🫐 Arándano', '🍒 Cereza', '🍊 Cítricos', 'Manzana', 'Uva', 'Fruta de Hueso'] },
        { group: 'Dulce/Nueces', tags: ['🍫 Chocolate', 'Caramelo', 'Azúcar Morena', 'Miel', 'Almendra', 'Avellana', 'Cacahuete'] },
        { group: 'Floral/Especias', tags: ['🌸 Jazmín', 'Té Negro', 'Vainilla', 'Canela', 'Pimienta', 'Clavo'] },
        { group: 'Tueste', tags: ['🍞 Pan Tostado', 'Humo', 'Tabaco', 'Cereal', 'Quemado'] }
    ],
    'Whisky': [
        { group: 'Fruta/Floral', tags: ['🍏 Manzana', 'Pera', 'Cítricos', 'Frutos Secos', 'Pasas', 'Jerez', 'Miel', 'Brezo'] },
        { group: 'Roble/Dulce', tags: ['🍦 Vainilla', 'Caramelo', 'Toffee', 'Coco', 'Arce', 'Mantequilla'] },
        { group: 'Especias', tags: ['Canela', 'Nuez Moscada', 'Pimienta', 'Jengibre', 'Clavo'] },
        { group: 'Turba/Humo', tags: ['🔥 Humo', 'Turba', 'Yodo', 'Sal Marina', 'Algas', 'Ceniza', 'Bacon'] }
    ],
    'Ron': [
        { group: 'Dulce', tags: ['Melaza', 'Caramelo', 'Azúcar Quemada', 'Toffee', 'Miel', 'Jarabe'] },
        { group: 'Fruta', tags: ['🍌 Banana', '🍍 Piña', 'Coco', 'Mango', 'Pasas', 'Higo'] },
        { group: 'Crianza', tags: ['🪵 Roble', '🍦 Vainilla', 'Tabaco', 'Cuero', 'Café', 'Chocolate'] },
        { group: 'Especias', tags: ['Canela', 'Nuez Moscada', 'Pimienta de Jamaica', 'Jengibre'] }
    ],
    'Gin': [
        { group: 'Enebro', tags: ['🌲 Pino', 'Resina', 'Madera', 'Verde'] },
        { group: 'Cítrico', tags: ['🍋 Limón', '🍊 Naranja', 'Pomelo', 'Lima', 'Bergamota'] },
        { group: 'Especias', tags: ['Coriandro', 'Cardamomo', 'Pimienta', 'Canela', 'Anís', 'Regaliz'] },
        { group: 'Floral/Herbal', tags: ['🌸 Lavanda', 'Rosa', 'Manzanilla', 'Pepino', 'Romero', 'Tomillo'] }
    ],
    'Tequila': [
        { group: 'Agave', tags: ['🌵 Agave Cocido', 'Agave Crudo', 'Hierba', 'Tierra'] },
        { group: 'Crianza', tags: ['🪵 Roble', '🍦 Vainilla', 'Caramelo', 'Mantequilla'] },
        { group: 'Fruta/Floral', tags: ['Cítricos', 'Pera', 'Manzana', 'Flores Blancas'] },
        { group: 'Especias', tags: ['Pimienta', 'Canela', 'Menta'] }
    ],
    'Vodka': [
        { group: 'Base/Grano', tags: ['🌾 Trigo', 'Centeno', 'Patata', 'Maíz', 'Uva'] },
        { group: 'Aroma', tags: ['🍋 Cítrico', 'Pimienta Negra', 'Vainilla', 'Medicinal', '🍞 Pan'] },
        { group: 'Boca', tags: ['Oleoso', 'Cremoso', 'Metálico', 'Quemante', 'Limpio'] }
    ],
    'Brandy': [
        { group: 'Fruta', tags: ['🍇 Uva Pasas', 'Higo', 'Ciruela', 'Albaricoque', 'Cáscara Naranja'] },
        { group: 'Crianza', tags: ['🪵 Roble', '🍦 Vainilla', 'Caramelo', 'Tabaco', 'Cuero', 'Café'] },
        { group: 'Floral/Especias', tags: ['🌸 Violeta', 'Canela', 'Clavo', 'Nuez Moscada', 'Rancio'] }
    ],
    'Generico': [
        { group: 'General', tags: ['Dulce', 'Ácido', 'Amargo', 'Salado', 'Umami'] },
        { group: 'Fruta', tags: ['Cítrico', 'Frutos Rojos', 'Fruta Tropical', 'Fruta de Hueso'] },
        { group: 'Vegetal', tags: ['Herbal', 'Floral', 'Madera', 'Tierra'] },
        { group: 'Otros', tags: ['Especias', 'Tostado', 'Lácteo', 'Químico'] }
    ]
};

export const VISUAL_DATA: Record<string, FlavorGroup[]> = {
    'Vino': [
        { group: 'Tinto', tags: ['Púrpura', 'Rubí', 'Granate', 'Teja', 'Marrón', 'Tinta China'] },
        { group: 'Blanco/Rosado', tags: ['Amarillo Pálido', 'Limón', 'Dorado', 'Ámbar', 'Piel de Cebolla', 'Salmón', 'Rosa Pálido'] },
        { group: 'Intensidad', tags: ['Pálido', 'Medio', 'Profundo', 'Opaco', 'Translucido'] },
        { group: 'Aspecto', tags: ['Brillante', 'Limpio', 'Turbio', 'Lágrima Densa', 'Lágrima Ligera', 'Burbuja Fina'] }
    ],
    'Cerveza': [
        { group: 'Color', tags: ['Pajizo', 'Amarillo', 'Dorado', 'Ámbar', 'Cobrizo', 'Marrón', 'Negro Petróleo'] },
        { group: 'Claridad', tags: ['Cristalina', 'Brillante', 'Velada', 'Turbia (Hazy)', 'Opaca'] },
        { group: 'Espuma', tags: ['Blanca', 'Beige (Marfil)', 'Marrón', 'Jabonosa', 'Cremosa', 'Persistente', 'Efímera'] }
    ],
    'Whisky': [
        { group: 'Color', tags: ['Incoloro (New Make)', 'Paja', 'Oro Pálido', 'Oro Viejo', 'Ámbar', 'Cobre', 'Caoba', 'Melaza'] },
        { group: 'Claridad', tags: ['Brillante', 'Limpio', 'Turbio (No Chill Filtered)'] },
        { group: 'Lágrima', tags: ['Rápida', 'Lenta', 'Aceitosa', 'Piernas Anchas'] }
    ],
    'Ron': [
        { group: 'Color', tags: ['Transparente', 'Plata', 'Dorado', 'Ámbar', 'Cobre', 'Caoba Oscuro'] },
        { group: 'Aspecto', tags: ['Brillante', 'Limpio', 'Denso', 'Aceitoso'] }
    ],
    'Café': [
        { group: 'Color', tags: ['Negro Profundo', 'Marrón Oscuro', 'Rojizo', 'Avellana'] },
        { group: 'Crema (Espresso)', tags: ['Atigrada', 'Avellana', 'Elástica', 'Fina', 'Espesa'] },
        { group: 'Cuerpo Visual', tags: ['Aguado', 'Denso', 'Jarabe'] }
    ],
    'Vodka': [
        { group: 'Color', tags: ['Incoloro', 'Cristalino', 'Plateado'] },
        { group: 'Textura', tags: ['Fluido', 'Denso', 'Lágrima Rápida', 'Aceitoso'] }
    ],
    'Brandy': [
        { group: 'Color', tags: ['Ámbar', 'Oro Viejo', 'Cobre', 'Caoba', 'Topacio'] },
        { group: 'Aspecto', tags: ['Brillante', 'Limpio', 'Denso', 'Lágrima Lenta'] }
    ],
    'Generico': [
        { group: 'Color', tags: ['Incoloro', 'Amarillo', 'Naranja', 'Rojo', 'Marrón', 'Negro'] },
        { group: 'Intensidad', tags: ['Claro', 'Oscuro', 'Brillante', 'Opaco'] },
        { group: 'Textura', tags: ['Fluido', 'Denso', 'Viscoso'] }
    ]
};

export const getFlavorGroups = (category: string): FlavorGroup[] => {
    if (FLAVOR_DATA[category]) return FLAVOR_DATA[category];
    
    const lower = category.toLowerCase();
    if (lower.includes('vino') || lower.includes('wine')) return FLAVOR_DATA['Vino'];
    if (lower.includes('cerveza') || lower.includes('beer') || lower.includes('lager') || lower.includes('ipa') || lower.includes('stout')) return FLAVOR_DATA['Cerveza'];
    if (lower.includes('café') || lower.includes('coffee')) return FLAVOR_DATA['Café'];
    if (lower.includes('whisky') || lower.includes('whiskey') || lower.includes('bourbon') || lower.includes('scotch')) return FLAVOR_DATA['Whisky'];
    if (lower.includes('ron') || lower.includes('rum')) return FLAVOR_DATA['Ron'];
    if (lower.includes('gin') || lower.includes('ginebra')) return FLAVOR_DATA['Gin'];
    if (lower.includes('tequila') || lower.includes('mezcal')) return FLAVOR_DATA['Tequila'];
    if (lower.includes('vodka')) return FLAVOR_DATA['Vodka'];
    if (lower.includes('brandy') || lower.includes('cognac')) return FLAVOR_DATA['Brandy'];

    return FLAVOR_DATA['Generico'];
};

export const getVisualGroups = (category: string): FlavorGroup[] => {
    if (VISUAL_DATA[category]) return VISUAL_DATA[category];

    const lower = category.toLowerCase();
    if (lower.includes('vino') || lower.includes('wine')) return VISUAL_DATA['Vino'];
    if (lower.includes('cerveza') || lower.includes('beer') || lower.includes('lager') || lower.includes('ipa') || lower.includes('stout')) return VISUAL_DATA['Cerveza'];
    if (lower.includes('whisky') || lower.includes('whiskey') || lower.includes('bourbon') || lower.includes('scotch')) return VISUAL_DATA['Whisky'];
    if (lower.includes('ron') || lower.includes('rum')) return VISUAL_DATA['Ron'];
    if (lower.includes('café') || lower.includes('coffee')) return VISUAL_DATA['Café'];
    if (lower.includes('vodka')) return VISUAL_DATA['Vodka'];
    if (lower.includes('brandy') || lower.includes('cognac')) return VISUAL_DATA['Brandy'];

    return VISUAL_DATA['Generico'];
};

// --- NEW HELPER: Get Color for Tag from Wheel Data ---
export const getTagColor = (tag: string): string => {
    const cleanTag = tag.trim().toLowerCase();
    
    // Iterate through Flavor Wheel Data to find the group color
    // This is a naive search, but O(N) is small here (Wheel size is fixed)
    for (const group of FLAVOR_WHEEL_DATA) {
        // Check group name match
        if (group.name.toLowerCase().includes(cleanTag)) return group.color;
        
        // Check children
        if (group.children) {
            for (const sub of group.children) {
                if (sub.name.toLowerCase().includes(cleanTag)) return group.color; // Return parent group color for consistency
                
                if (sub.children) {
                    for (const leaf of sub.children) {
                        if (leaf.name.toLowerCase().includes(cleanTag)) return group.color;
                    }
                }
            }
        }
    }
    
    // Fallback: Check standard lists if not found in wheel
    for (const catKey in FLAVOR_DATA) {
        for (const group of FLAVOR_DATA[catKey]) {
            if (group.tags.some(t => t.toLowerCase().includes(cleanTag))) {
                // Map generic group names to wheel colors if possible
                const gName = group.group.toLowerCase();
                if (gName.includes('fruta roja')) return '#ef4444';
                if (gName.includes('fruta negra')) return '#581c87';
                if (gName.includes('cítrico') || gName.includes('tropical')) return '#eab308';
                if (gName.includes('floral') || gName.includes('herba')) return '#84cc16';
                if (gName.includes('vegetal')) return '#15803d';
                if (gName.includes('especi')) return '#c2410c';
                if (gName.includes('roble') || gName.includes('crianza') || gName.includes('tostado')) return '#854d0e';
                if (gName.includes('tierra') || gName.includes('mineral')) return '#475569';
            }
        }
    }

    return '#475569'; // Default Slate
};
