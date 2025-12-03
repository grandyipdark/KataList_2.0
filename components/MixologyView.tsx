
import React, { useMemo } from 'react';
import { useKataContext } from '../context/KataContext';
import { Icon } from './Shared';
import { COCKTAILS, findCocktails } from '../utils/cocktailData';

export const MixologyView = React.memo(() => {
    const { tastings, setView } = useKataContext();

    const { available, almost } = useMemo(() => findCocktails(tastings), [tastings]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-dark-950 pb-20 animate-fade-in">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-white/95 dark:bg-dark-900/95 backdrop-blur sticky top-0 z-20">
                <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition active:scale-95">
                    <Icon name="arrow_back" />
                </button>
                <div>
                    <h2 className="font-bold text-slate-900 dark:text-white font-serif text-lg">Bartender 🍸</h2>
                    <p className="text-[10px] text-pink-500 dark:text-pink-400 font-bold uppercase tracking-wider">Mixología Inteligente</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* Available Section */}
                <div>
                    <h3 className="text-sm font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Icon name="check_circle" /> Puedes preparar ahora
                    </h3>
                    {available.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                            {available.map(c => (
                                <div key={c.id} className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-green-200 dark:border-green-900/30 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm">
                                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400 text-2xl border border-green-200 dark:border-green-500/20">
                                        🍹
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-900 dark:text-white text-lg font-serif">{c.name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{c.description}</p>
                                        <div className="flex gap-2 mt-1">
                                            {c.tags.map(t => <span key={t} className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 rounded">{t}</span>)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center">
                            <Icon name="liquor" className="text-4xl text-slate-400 dark:text-slate-600 mb-2" />
                            <p className="text-slate-600 dark:text-slate-400 text-sm">No tienes combinaciones completas en stock.</p>
                            <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-xl inline-block text-left shadow-md">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Sugerencia de Compra:</p>
                                <ul className="text-xs text-slate-800 dark:text-white list-disc list-inside">
                                    <li>Gin + Tónica = Gin Tonic</li>
                                    <li>Ron + Cola = Cuba Libre</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Almost Available Section */}
                {almost.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-2 mt-4">
                            <Icon name="shopping_cart" /> Te falta un ingrediente
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {almost.map(c => (
                                <div key={c.id} className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 flex items-center gap-4 opacity-90 hover:opacity-100 transition shadow-sm">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-2xl border border-slate-200 dark:border-slate-700">
                                        🍸
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-700 dark:text-slate-200 text-base">{c.name}</h4>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="text-xs text-red-600 dark:text-red-400 font-bold bg-red-100 dark:bg-red-900/20 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/30">Comprar: {c.missing?.join(', ')}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
