
export interface FlavorNode {
    name: string;
    color: string;
    children?: FlavorNode[];
}

export const FLAVOR_WHEEL_DATA: FlavorNode[] = [
    // 1. FRUTOS ROJOS (Rojo Intenso)
    {
        name: "Fruta Roja",
        color: "#ef4444", // Red-500
        children: [
            { name: "Fresca", color: "#f87171", children: [{name: "Fresa", color: "#fca5a5"}, {name: "Frambuesa", color: "#fca5a5"}, {name: "Grosella Roja", color: "#fca5a5"}, {name: "Granada", color: "#fca5a5"}, {name: "Sandía", color: "#fca5a5"}] },
            { name: "Cerezos", color: "#b91c1c", children: [{name: "Cereza Roja", color: "#fecaca"}, {name: "Guinda", color: "#fecaca"}, {name: "Kirsch", color: "#fecaca"}] },
            { name: "Cocida/Dulce", color: "#7f1d1d", children: [{name: "Mermelada Fresa", color: "#fee2e2"}, {name: "Fruta Confitada", color: "#fee2e2"}, {name: "Compota", color: "#fee2e2"}] }
        ]
    },
    // 2. FRUTOS NEGROS/AZULES (Púrpura/Azul Oscuro)
    {
        name: "Fruta Negra",
        color: "#581c87", // Purple-900
        children: [
            { name: "Bayas", color: "#6b21a8", children: [{name: "Mora", color: "#d8b4fe"}, {name: "Arándano", color: "#d8b4fe"}, {name: "Cassis", color: "#d8b4fe"}, {name: "Endrina", color: "#d8b4fe"}] },
            { name: "Hueso", color: "#4c1d95", children: [{name: "Ciruela Negra", color: "#ddd6fe"}, {name: "Cereza Negra", color: "#ddd6fe"}, {name: "Aceituna Negra", color: "#ddd6fe"}] },
            { name: "Seca/Pasa", color: "#312e81", children: [{name: "Uva Pasa", color: "#e0e7ff"}, {name: "Ciruela Pasa", color: "#e0e7ff"}, {name: "Higo Seco", color: "#e0e7ff"}, {name: "Dátil", color: "#e0e7ff"}] }
        ]
    },
    // 3. CÍTRICOS Y TROPICAL (Amarillo/Naranja Claro)
    {
        name: "Cítrico/Tropical",
        color: "#eab308", // Yellow-500
        children: [
            { name: "Cítricos", color: "#facc15", children: [{name: "Limón", color: "#fef08a"}, {name: "Lima", color: "#fef08a"}, {name: "Pomelo", color: "#fef08a"}, {name: "Naranja", color: "#fef08a"}, {name: "Mandarina", color: "#fef08a"}] },
            { name: "Tropical", color: "#f59e0b", children: [{name: "Piña", color: "#fde68a"}, {name: "Mango", color: "#fde68a"}, {name: "Maracuyá", color: "#fde68a"}, {name: "Plátano", color: "#fde68a"}, {name: "Litchi", color: "#fde68a"}] },
            { name: "Hueso/Poma", color: "#fbbf24", children: [{name: "Melocotón", color: "#fef3c7"}, {name: "Albaricoque", color: "#fef3c7"}, {name: "Manzana", color: "#fef3c7"}, {name: "Pera", color: "#fef3c7"}, {name: "Membrillo", color: "#fef3c7"}] }
        ]
    },
    // 4. FLORAL Y HERBAL (Verde Claro/Lila)
    {
        name: "Floral/Herbal",
        color: "#84cc16", // Lime-500
        children: [
            { name: "Flores", color: "#d8b4fe", children: [{name: "Rosa", color: "#f3e8ff"}, {name: "Violeta", color: "#f3e8ff"}, {name: "Jazmín", color: "#f3e8ff"}, {name: "Azahar", color: "#f3e8ff"}, {name: "Lavanda", color: "#f3e8ff"}] },
            { name: "Hierbas", color: "#a3e635", children: [{name: "Menta", color: "#ecfccb"}, {name: "Eucalipto", color: "#ecfccb"}, {name: "Hinojo", color: "#ecfccb"}, {name: "Eneldo", color: "#ecfccb"}, {name: "Tomillo", color: "#ecfccb"}] },
            { name: "Infusiones", color: "#bef264", children: [{name: "Té Negro", color: "#f7fee7"}, {name: "Manzanilla", color: "#f7fee7"}, {name: "Tabaco Fresco", color: "#f7fee7"}] }
        ]
    },
    // 5. VEGETAL (Verde Oscuro)
    {
        name: "Vegetal",
        color: "#15803d", // Green-700
        children: [
            { name: "Fresco/Verde", color: "#16a34a", children: [{name: "Hierba Cortada", color: "#dcfce7"}, {name: "Pimiento Verde", color: "#dcfce7"}, {name: "Hoja Tomate", color: "#dcfce7"}, {name: "Espárrago", color: "#dcfce7"}] },
            { name: "Cocinado", color: "#14532d", children: [{name: "Judía Verde", color: "#f0fdf4"}, {name: "Alcachofa", color: "#f0fdf4"}, {name: "Aceituna", color: "#f0fdf4"}, {name: "Ruibarbo", color: "#f0fdf4"}] },
            { name: "Bosque", color: "#064e3b", children: [{name: "Musgo", color: "#ecfdf5"}, {name: "Hojarasca", color: "#ecfdf5"}, {name: "Helecho", color: "#ecfdf5"}] }
        ]
    },
    // 6. ESPECIAS (Naranja/Rojo Óxido)
    {
        name: "Especias",
        color: "#c2410c", // Orange-700
        children: [
            { name: "Picantes", color: "#ea580c", children: [{name: "Pimienta Negra", color: "#ffedd5"}, {name: "Pimienta Blanca", color: "#ffedd5"}, {name: "Guindilla/Chile", color: "#ffedd5"}, {name: "Jengibre", color: "#ffedd5"}] },
            { name: "Dulces", color: "#f97316", children: [{name: "Canela", color: "#fff7ed"}, {name: "Clavo", color: "#fff7ed"}, {name: "Nuez Moscada", color: "#fff7ed"}, {name: "Anís", color: "#fff7ed"}, {name: "Regaliz", color: "#fff7ed"}] },
            { name: "Semillas", color: "#fdba74", children: [{name: "Coriandro", color: "#fff7ed"}, {name: "Cardamomo", color: "#fff7ed"}, {name: "Comino", color: "#fff7ed"}] }
        ]
    },
    // 7. CRIANZA Y TOSTADOS (Marrón/Dorado)
    {
        name: "Crianza/Roble",
        color: "#854d0e", // Yellow-800 (Brownish)
        children: [
            { name: "Madera", color: "#a16207", children: [{name: "Roble", color: "#fef9c3"}, {name: "Cedro", color: "#fef9c3"}, {name: "Caja Puros", color: "#fef9c3"}, {name: "Sándalo", color: "#fef9c3"}, {name: "Serrín", color: "#fef9c3"}] },
            { name: "Tostados", color: "#713f12", children: [{name: "Humo", color: "#fefce8"}, {name: "Café", color: "#fefce8"}, {name: "Chocolate", color: "#fefce8"}, {name: "Cacao", color: "#fefce8"}, {name: "Pan Tostado", color: "#fefce8"}] },
            { name: "Dulces", color: "#ca8a04", children: [{name: "Vainilla", color: "#fef08a"}, {name: "Caramelo", color: "#fef08a"}, {name: "Coco", color: "#fef08a"}, {name: "Mantequilla", color: "#fef08a"}, {name: "Miel", color: "#fef08a"}] },
            { name: "Frutos Secos", color: "#b45309", children: [{name: "Almendra", color: "#ffedd5"}, {name: "Avellana", color: "#ffedd5"}, {name: "Nuez", color: "#ffedd5"}] }
        ]
    },
    // 8. TIERRA Y OTROS (Gris/Azul)
    {
        name: "Tierra/Otros",
        color: "#475569", // Slate-600
        children: [
            { name: "Mineral", color: "#64748b", children: [{name: "Piedra Mojada", color: "#f1f5f9"}, {name: "Tiza", color: "#f1f5f9"}, {name: "Grafito", color: "#f1f5f9"}, {name: "Salino", color: "#f1f5f9"}, {name: "Petróleo", color: "#f1f5f9"}] },
            { name: "Animal/Bio", color: "#334155", children: [{name: "Cuero", color: "#e2e8f0"}, {name: "Carne", color: "#e2e8f0"}, {name: "Almizcle", color: "#e2e8f0"}, {name: "Champiñón", color: "#e2e8f0"}, {name: "Trufa", color: "#e2e8f0"}] },
            { name: "Levadura", color: "#94a3b8", children: [{name: "Pan/Brioche", color: "#f8fafc"}, {name: "Galleta", color: "#f8fafc"}, {name: "Queso/Lácteo", color: "#f8fafc"}] }
        ]
    }
];
