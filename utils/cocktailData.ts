import { Tasting } from "../types";

export interface Cocktail {
    id: string;
    name: string;
    ingredients: string[]; // required keywords in category/subcategory
    tags: string[]; // e.g. "Clásico", "Refrescante"
    description: string;
    missing?: string[]; // dynamically added
}

export const COCKTAILS: Cocktail[] = [
    { id: '1', name: 'Gin Tonic', ingredients: ['gin'], tags: ['Clásico', 'Refrescante'], description: 'Tu Gin favorito con tónica y hielo. Simple y perfecto.' },
    { id: '2', name: 'Martini', ingredients: ['gin', 'vermut'], tags: ['Elegante', 'Fuerte'], description: 'Gin y Vermut seco. Agitado, no revuelto.' },
    { id: '3', name: 'Negroni', ingredients: ['gin', 'vermut'], tags: ['Amargo', 'Aperitivo'], description: 'Gin, Vermut Rojo y Campari a partes iguales.' },
    { id: '4', name: 'Old Fashioned', ingredients: ['whisky', 'bourbon'], tags: ['Clásico', 'Dulce'], description: 'Whisky, azúcar y amargo de Angostura.' },
    { id: '5', name: 'Manhattan', ingredients: ['whisky', 'vermut'], tags: ['Sofisticado'], description: 'Whisky (Rye) y Vermut Rojo.' },
    { id: '6', name: 'Margarita', ingredients: ['tequila'], tags: ['Fiesta', 'Ácido'], description: 'Tequila, licor de naranja y lima. Borde de sal.' },
    { id: '7', name: 'Mojito', ingredients: ['ron'], tags: ['Tropical', 'Dulce'], description: 'Ron blanco, menta, lima, azúcar y soda.' },
    { id: '8', name: 'Cuba Libre', ingredients: ['ron'], tags: ['Fiestero'], description: 'Ron y Cola con lima.' },
    { id: '9', name: 'Daiquiri', ingredients: ['ron'], tags: ['Frutal'], description: 'Ron blanco, lima y azúcar. Agitado con hielo.' },
    { id: '10', name: 'Whisky Sour', ingredients: ['whisky'], tags: ['Ácido', 'Suave'], description: 'Whisky, limón y azúcar. Clara de huevo opcional.' },
    { id: '11', name: 'Espresso Martini', ingredients: ['vodka', 'café'], tags: ['Energético', 'Postre'], description: 'Vodka, licor de café y un espresso recién hecho.' },
    { id: '12', name: 'Aperol Spritz', ingredients: ['espumoso'], tags: ['Verano', 'Aperitivo'], description: 'Prosecco, Aperol y Soda.' },
    { id: '13', name: 'Carajillo', ingredients: ['brandy', 'café'], tags: ['Digestivo'], description: 'Café caliente con un chorro de Brandy.' },
    { id: '14', name: 'Sangría', ingredients: ['vino'], tags: ['Compartir'], description: 'Vino tinto, frutas picadas, azúcar y un toque de brandy.' },
    { id: '15', name: 'Michelada', ingredients: ['cerveza'], tags: ['Picante', 'Refrescante'], description: 'Cerveza, lima, sal y salsas picantes.' }
];

export const findCocktails = (inventory: Tasting[]): { available: Cocktail[], almost: Cocktail[] } => {
    // Flatten inventory into a searchable set of keywords
    const keywords = new Set<string>();
    
    inventory.forEach(t => {
        if ((t.stock || 0) > 0) {
            keywords.add(t.category.toLowerCase());
            keywords.add(t.subcategory.toLowerCase());
            if (t.name.toLowerCase().includes('vermut')) keywords.add('vermut');
            if (t.category.toLowerCase() === 'brandy') keywords.add('brandy');
        }
    });

    const available: Cocktail[] = [];
    const almost: Cocktail[] = [];

    COCKTAILS.forEach(c => {
        const missing = c.ingredients.filter(ing => !keywords.has(ing) && !Array.from(keywords).some(k => k.includes(ing)));
        
        if (missing.length === 0) {
            available.push(c);
        } else if (missing.length === 1 && c.ingredients.length > 1) {
            // If only 1 ingredient missing (and recipe has >1 main ingredients), suggest it
            almost.push({ ...c, missing });
        }
    });

    return { available, almost };
};