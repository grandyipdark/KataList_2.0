
import React, { useState, useMemo } from 'react';
import { useKataContext } from '../context/KataContext';
import { Icon, SafeImage } from './Shared';
import { getCountryFlag, getCategoryColor } from '../utils/helpers';
import { Tasting } from '../types';

interface FoodCategory {
    id: string;
    label: string;
    icon: string;
    color: string;
    matchLogic: (t: Tasting) => boolean;
    suggestion: string; // New field for empty state
}

export const ChefMode = React.memo(() => {
    const { tastings, setView, setSelectedTasting, categories } = useKataContext();
    const [selectedFood, setSelectedFood] = useState<FoodCategory | null>(null);

    // Only inventory items (Stock > 0)
    const inventory = useMemo(() => tastings.filter(t => (t.stock || 0) > 0), [tastings]);

    // --- PAIRING LOGIC ENGINE ---
    // Simple heuristic matching based on Category, Subcategory and Tags
    const foodCategories: FoodCategory[] = [
        {
            id: 'meat', label: 'Carnes Rojas', icon: 'lunch_dining', color: 'from-red-900 to-slate-900',
            suggestion: 'Compra un Cabernet Sauvignon, Malbec o Syrah.',
            matchLogic: (t) => {
                const cat = t.category.toLowerCase();
                const sub = (t.subcategory || '').toLowerCase();
                // Red Wine (Cabernet, Malbec, Syrah, Tempranillo)
                if (cat.includes('vino') && (sub.includes('tinto') || sub.includes('red') || sub.includes('cabernet') || sub.includes('malbec') || sub.includes('syrah') || sub.includes('merlot') || sub.includes('tempranillo') || sub.includes('rioja'))) return true;
                // Peated/Sherry Whisky
                if (cat.includes('whisky') && (sub.includes('single') || sub.includes('ahumado') || t.tags.some(tag => tag.toLowerCase().includes('humo')))) return true;
                // Aged Rum
                if (cat.includes('ron') && (sub.includes('añejo') || sub.includes('dorado'))) return true;
                return false;
            }
        },
        {
            id: 'pizza', label: 'Pizza / Pasta', icon: 'local_pizza', color: 'from-orange-900 to-slate-900',
            suggestion: 'Compra un Chianti, Sangiovese o una Lager.',
            matchLogic: (t) => {
                const cat = t.category.toLowerCase();
                const sub = (t.subcategory || '').toLowerCase();
                // Red Wine (Sangiovese, Chianti, Merlot)
                if (cat.includes('vino') && (sub.includes('tinto') || sub.includes('sangiovese') || sub.includes('chianti') || sub.includes('merlot'))) return true;
                // Beer (Lager, Pale Ale)
                if (cat.includes('cerveza') && (sub.includes('lager') || sub.includes('pale ale') || sub.includes('pilsner'))) return true;
                return false;
            }
        },
        {
            id: 'seafood', label: 'Pescado / Sushi', icon: 'set_meal', color: 'from-cyan-900 to-slate-900',
            suggestion: 'Compra un Sauvignon Blanc, Albariño o Cerveza de Trigo.',
            matchLogic: (t) => {
                const cat = t.category.toLowerCase();
                const sub = (t.subcategory || '').toLowerCase();
                // White Wine, Rose, Sparkling
                if (cat.includes('vino') && (sub.includes('blanco') || sub.includes('white') || sub.includes('rosado') || sub.includes('espumoso') || sub.includes('sauvignon') || sub.includes('chardonnay'))) return true;
                // Gin
                if (cat.includes('gin')) return true;
                // Light Beer
                if (cat.includes('cerveza') && (sub.includes('lager') || sub.includes('trigo') || sub.includes('witbier'))) return true;
                // Tequila Blanco / Sake
                if (cat.includes('tequila') && sub.includes('blanco')) return true;
                if (cat.includes('sake')) return true;
                return false;
            }
        },
        {
            id: 'cheese', label: 'Quesos / Tablas', icon: 'egg', color: 'from-yellow-900 to-slate-900',
            suggestion: 'Compra Oporto, Jerez o una cerveza Stout.',
            matchLogic: (t) => {
                const cat = t.category.toLowerCase();
                const sub = (t.subcategory || '').toLowerCase();
                // Almost any wine works, specifically Port or White for soft cheese, Red for hard
                if (cat.includes('vino')) return true;
                // Fortified
                if (cat.includes('brandy') || sub.includes('jerez') || sub.includes('oporto')) return true;
                // Beer (Stout, Belgian)
                if (cat.includes('cerveza') && (sub.includes('stout') || sub.includes('belgian') || sub.includes('trappist'))) return true;
                return false;
            }
        },
        {
            id: 'dessert', label: 'Postres', icon: 'icecream', color: 'from-pink-900 to-slate-900',
            suggestion: 'Compra Vino Dulce, Ron Añejo o Café.',
            matchLogic: (t) => {
                const cat = t.category.toLowerCase();
                const sub = (t.subcategory || '').toLowerCase();
                // Sweet wines, Port, Sherry
                if (cat.includes('vino') && (sub.includes('dulce') || sub.includes('late harvest') || sub.includes('oporto') || sub.includes('pedro ximenez'))) return true;
                // Aged Spirits: Rum, Bourbon, Brandy
                if (cat.includes('ron') || cat.includes('brandy') || (cat.includes('whisky') && sub.includes('bourbon'))) return true;
                // Stout Beer
                if (cat.includes('cerveza') && (sub.includes('stout') || sub.includes('porter'))) return true;
                // Coffee Liqueur / Coffee
                if (cat.includes('café') || cat.includes('cafe')) return true;
                return false;
            }
        },
        {
            id: 'spicy', label: 'Picante / Tacos', icon: 'local_fire_department', color: 'from-red-800 to-slate-900',
            suggestion: 'Compra una IPA, Tequila o Riesling.',
            matchLogic: (t) => {
                const cat = t.category.toLowerCase();
                const sub = (t.subcategory || '').toLowerCase();
                // Beer (IPA, Lager)
                if (cat.includes('cerveza') && (sub.includes('ipa') || sub.includes('lager'))) return true;
                // Sweet White Wine (Riesling) to balance heat
                if (cat.includes('vino') && (sub.includes('riesling') || sub.includes('gewürz') || sub.includes('moscato'))) return true;
                // Tequila / Mezcal
                if (cat.includes('tequila') || cat.includes('mezcal')) return true;
                return false;
            }
        },
        {
            id: 'salad', label: 'Ensalada / Ligero', icon: 'nutrition', color: 'from-green-900 to-slate-900',
            suggestion: 'Compra Pinot Grigio, Verdejo o Gin.',
            matchLogic: (t) => {
                const cat = t.category.toLowerCase();
                const sub = (t.subcategory || '').toLowerCase();
                // White/Rose Wine
                if (cat.includes('vino') && (sub.includes('blanco') || sub.includes('rosado') || sub.includes('pinot grigio') || sub.includes('verdejo'))) return true;
                // Gin
                if (cat.includes('gin')) return true;
                // Light Beer
                if (cat.includes('cerveza') && sub.includes('lager')) return true;
                return false;
            }
        },
        {
            id: 'bbq', label: 'BBQ / Ahumados', icon: 'outdoor_grill', color: 'from-slate-700 to-slate-900',
            suggestion: 'Compra Zinfandel, Bourbon o Mezcal.',
            matchLogic: (t) => {
                const cat = t.category.toLowerCase();
                const sub = (t.subcategory || '').toLowerCase();
                // Bold Reds
                if (cat.includes('vino') && (sub.includes('syrah') || sub.includes('shiraz') || sub.includes('malbec') || sub.includes('zinfandel'))) return true;
                // Smoky Whisky/Mezcal
                if (cat.includes('mezcal') || (cat.includes('whisky') && (sub.includes('islay') || t.tags.includes('Humo')))) return true;
                // Bourbon
                if (cat.includes('whisky') && sub.includes('bourbon')) return true;
                return false;
            }
        }
    ];

    const matchedItems = useMemo(() => {
        if (!selectedFood) return [];
        return inventory.filter(t => selectedFood.matchLogic(t)).sort((a,b) => b.score - a.score);
    }, [selectedFood, inventory]);

    return (
        <div className="flex flex-col h-full bg-dark-950 pb-20 animate-fade-in">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-dark-900/95 backdrop-blur sticky top-0 z-20">
                <button onClick={() => selectedFood ? setSelectedFood(null) : setView('DASHBOARD')} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition active:scale-95">
                    <Icon name="arrow_back" />
                </button>
                <div>
                    <h2 className="font-bold text-white font-serif text-lg">Chef Mode 👨‍🍳</h2>
                    <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Maridaje Inverso</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {!selectedFood ? (
                    <>
                        <p className="text-center text-slate-400 text-sm mb-6 mt-2">¿Qué vas a comer hoy? Te sugerimos de tu bodega.</p>
                        <div className="grid grid-cols-2 gap-3">
                            {foodCategories.map(food => (
                                <button
                                    key={food.id}
                                    onClick={() => setSelectedFood(food)}
                                    className={`relative h-32 rounded-2xl overflow-hidden shadow-lg group active:scale-[0.98] transition border border-white/5`}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-br ${food.color} opacity-80 group-hover:opacity-100 transition duration-500`}></div>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center z-10">
                                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mb-2 border border-white/20 shadow-inner">
                                            <Icon name={food.icon} className="text-2xl text-white" />
                                        </div>
                                        <span className="font-bold text-white text-sm drop-shadow-md">{food.label}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="animate-slide-up">
                        <div className={`p-6 rounded-2xl bg-gradient-to-br ${selectedFood.color} mb-6 shadow-xl relative overflow-hidden`}>
                            <Icon name={selectedFood.icon} className="absolute -right-4 -bottom-4 text-9xl text-white opacity-10" />
                            <h3 className="text-2xl font-bold text-white font-serif mb-1">{selectedFood.label}</h3>
                            <p className="text-white/70 text-xs">Recomendaciones basadas en tu stock.</p>
                        </div>

                        {matchedItems.length > 0 ? (
                            <div className="space-y-3">
                                {matchedItems.map(t => (
                                    <div key={t.id} onClick={() => { setSelectedTasting(t); setView('DETAIL'); }} className="flex items-center gap-3 bg-dark-800 p-2 rounded-xl border border-slate-700 hover:bg-slate-700/50 cursor-pointer active:scale-[0.99] transition shadow-sm">
                                        <div className="w-16 h-16 rounded-lg bg-slate-700 overflow-hidden flex-shrink-0 relative">
                                            {t.thumbnail || t.images[0] ? <SafeImage src={t.thumbnail || t.images[0]} className="w-full h-full object-cover" alt={t.name} /> : <div className="w-full h-full flex items-center justify-center"><Icon name="wine_bar" className="text-slate-500" /></div>}
                                            <div className="absolute bottom-0 left-0 w-1 bg-white/50 h-full" style={{ backgroundColor: getCategoryColor(t.category, categories) }}></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-bold text-sm text-white truncate">{t.name}</h3>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.score >= 8 ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>{t.score}</span>
                                            </div>
                                            <p className="text-xs text-slate-400 truncate">{t.category} • {t.subcategory}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-slate-500">{t.country} {getCountryFlag(t.country)}</span>
                                                <span className="text-[10px] text-green-400 bg-green-900/20 px-1 rounded border border-green-900/30">Stock: {t.stock}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-dark-800/50 rounded-2xl border border-dashed border-slate-700">
                                <Icon name="sentiment_dissatisfied" className="text-4xl text-slate-600 mb-2" />
                                <p className="text-slate-400 text-sm font-medium">No encontré nada en tu bodega para esto.</p>
                                
                                <div className="mt-4 p-4 bg-slate-800 rounded-xl inline-block text-left border border-slate-700 shadow-lg">
                                    <p className="text-xs text-primary-400 font-bold uppercase mb-1 flex items-center gap-2">
                                        <Icon name="shopping_cart" /> Lista de Compra Sugerida:
                                    </p>
                                    <p className="text-sm text-white font-serif">{selectedFood.suggestion}</p>
                                </div>

                                <div className="mt-6">
                                    <button onClick={() => setView('SEARCH')} className="text-blue-400 text-xs font-bold hover:text-blue-300 transition">Buscar en historial (sin stock)</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});
