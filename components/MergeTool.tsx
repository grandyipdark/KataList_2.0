
import React, { useState, useMemo } from 'react';
import { useKataContext } from '../context/KataContext';
import { Icon, SafeImage } from './Shared';
import { Tasting } from '../types';

export const MergeTool = React.memo(() => {
    const { tastings, setView, mergeTastings, renameProducer } = useKataContext();
    
    // --- Tabs State ---
    const [mode, setMode] = useState<'TASTINGS' | 'PRODUCERS'>('TASTINGS');

    // --- TASTING MERGE STATES ---
    const [searchLeft, setSearchLeft] = useState('');
    const [searchRight, setSearchRight] = useState('');
    const [selectedTarget, setSelectedTarget] = useState<Tasting | null>(null);
    const [selectedSource, setSelectedSource] = useState<Tasting | null>(null);

    // --- PRODUCER MERGE STATES ---
    const [selectedBadProducer, setSelectedBadProducer] = useState<string | null>(null);
    const [selectedGoodProducer, setSelectedGoodProducer] = useState<string | null>(null);
    const [filterProducer, setFilterProducer] = useState('');

    // --- COMPUTED: Tastings Filter ---
    const filteredLeft = useMemo(() => tastings.filter(t => t.name.toLowerCase().includes(searchLeft.toLowerCase())), [tastings, searchLeft]);
    const filteredRight = useMemo(() => tastings.filter(t => t.name.toLowerCase().includes(searchRight.toLowerCase()) && t.id !== selectedTarget?.id), [tastings, searchRight, selectedTarget]);

    // --- COMPUTED: Producers List ---
    const producersList = useMemo(() => {
        const counts: Record<string, number> = {};
        tastings.forEach(t => {
            if (t.producer) {
                const p = t.producer.trim();
                counts[p] = (counts[p] || 0) + 1;
            }
        });
        return Object.entries(counts)
            .sort((a,b) => b[1] - a[1]) // Sort by count descending
            .filter(([name]) => name.toLowerCase().includes(filterProducer.toLowerCase()));
    }, [tastings, filterProducer]);

    // --- HANDLERS ---
    const handleMergeTastings = () => {
        if (!selectedTarget || !selectedSource) return;
        mergeTastings(selectedSource.id, selectedTarget.id);
        setSelectedSource(null);
    };

    const handleMergeProducers = () => {
        if (!selectedBadProducer || !selectedGoodProducer) return;
        renameProducer(selectedBadProducer, selectedGoodProducer);
        setSelectedBadProducer(null);
    };

    const renderCard = (t: Tasting, onClick: () => void, isSelected: boolean, isDestructive: boolean = false) => (
        <div 
            onClick={onClick}
            className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-3 ${isSelected ? (isDestructive ? 'bg-red-900/30 border-red-500' : 'bg-primary-900/30 border-primary-500') : 'bg-dark-800 border-slate-700 hover:bg-slate-700'}`}
        >
            <div className="w-12 h-12 rounded-lg bg-slate-600 overflow-hidden flex-shrink-0">
                {t.images[0] ? <SafeImage src={t.images[0]} className="w-full h-full object-cover" alt={t.name} /> : <div className="w-full h-full flex items-center justify-center"><Icon name="image" /></div>}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white text-sm truncate">{t.name}</h4>
                <p className="text-xs text-slate-400">{t.category} • Stock: {t.stock}</p>
            </div>
            {isSelected && <Icon name="check_circle" className={isDestructive ? 'text-red-500' : 'text-primary-500'} />}
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-dark-950 pb-20 animate-fade-in">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex flex-col gap-3 bg-dark-900/95 backdrop-blur sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition active:scale-95">
                        <Icon name="arrow_back" />
                    </button>
                    <div>
                        <h2 className="font-bold text-white font-serif text-lg">Herramientas de Fusión</h2>
                        <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">Mantenimiento de Bodega</p>
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="flex bg-slate-800 p-1 rounded-xl">
                    <button 
                        onClick={() => setMode('TASTINGS')} 
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${mode === 'TASTINGS' ? 'bg-slate-700 text-white shadow' : 'text-slate-500'}`}
                    >
                        <Icon name="wine_bar" className="text-sm" /> Catas
                    </button>
                    <button 
                        onClick={() => setMode('PRODUCERS')} 
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${mode === 'PRODUCERS' ? 'bg-slate-700 text-white shadow' : 'text-slate-500'}`}
                    >
                        <Icon name="factory" className="text-sm" /> Productores
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* === MODE: TASTINGS (EXISTING LOGIC) === */}
                {mode === 'TASTINGS' && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Target Selection (Keep) */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-primary-400 uppercase tracking-wider flex items-center gap-2"><Icon name="save" /> Conservar (Destino)</h3>
                                <div className="relative">
                                    <Icon name="search" className="absolute left-3 top-3 text-slate-500 text-sm" />
                                    <input value={searchLeft} onChange={e => setSearchLeft(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-900 pl-9 pr-3 py-2 rounded-lg text-sm text-white border border-slate-700 outline-none focus:border-primary-500" />
                                </div>
                                <div className="h-64 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                                    {filteredLeft.map(t => renderCard(t, () => setSelectedTarget(t), selectedTarget?.id === t.id))}
                                </div>
                            </div>

                            {/* Source Selection (Merge & Delete) */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2"><Icon name="input" /> Fusionar (Se borrará)</h3>
                                <div className="relative">
                                    <Icon name="search" className="absolute left-3 top-3 text-slate-500 text-sm" />
                                    <input value={searchRight} onChange={e => setSearchRight(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-900 pl-9 pr-3 py-2 rounded-lg text-sm text-white border border-slate-700 outline-none focus:border-red-500" />
                                </div>
                                <div className="h-64 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                                    {filteredRight.map(t => renderCard(t, () => setSelectedSource(t), selectedSource?.id === t.id, true))}
                                </div>
                            </div>
                        </div>

                        {/* Merge Action Area */}
                        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center mt-4">
                            {selectedTarget && selectedSource ? (
                                <div className="animate-slide-up">
                                    <div className="flex items-center justify-center gap-4 mb-4">
                                        <div className="text-right">
                                            <p className="text-xs text-red-400 font-bold strike-through">{selectedSource.name}</p>
                                            <p className="text-[10px] text-slate-500">Stock: {selectedSource.stock}</p>
                                        </div>
                                        <Icon name="arrow_forward" className="text-slate-600" />
                                        <div className="text-left">
                                            <p className="text-xs text-primary-400 font-bold">{selectedTarget.name}</p>
                                            <p className="text-[10px] text-slate-500">Stock: {(selectedTarget.stock||0) + (selectedSource.stock||0)}</p>
                                        </div>
                                    </div>
                                    <button onClick={handleMergeTastings} className="bg-gradient-to-r from-primary-600 to-indigo-600 px-8 py-3 rounded-xl font-bold text-white shadow-lg hover:brightness-110 active:scale-95 transition flex items-center gap-2 mx-auto">
                                        <Icon name="merge" /> Confirmar Fusión
                                    </button>
                                    <p className="text-[10px] text-slate-500 mt-2">Se combinarán imágenes y etiquetas. La ficha roja se eliminará.</p>
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm">Selecciona dos elementos para unirlos.</p>
                            )}
                        </div>
                    </>
                )}

                {/* === MODE: PRODUCERS (NEW LOGIC) === */}
                {mode === 'PRODUCERS' && (
                    <div className="animate-fade-in space-y-4">
                        <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30 flex items-start gap-3">
                            <Icon name="info" className="text-blue-400 text-xl" />
                            <div className="text-xs text-blue-200">
                                <strong className="block mb-1">Unificar Nombres</strong>
                                Selecciona el nombre "Incorrecto" (o duplicado) y luego el nombre "Correcto". Todas las catas con el nombre incorrecto se actualizarán.
                            </div>
                        </div>

                        <div className="relative">
                            <Icon name="search" className="absolute left-3 top-3 text-slate-500 text-sm" />
                            <input value={filterProducer} onChange={e => setFilterProducer(e.target.value)} placeholder="Filtrar productores..." className="w-full bg-slate-900 pl-9 pr-3 py-3 rounded-xl text-sm text-white border border-slate-700 outline-none focus:border-primary-500" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Bad List */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-red-400 uppercase border-b border-red-500/30 pb-2">1. Origen (A Eliminar)</h4>
                                <div className="h-80 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                                    {producersList.map(([name, count]) => (
                                        <button 
                                            key={name} 
                                            onClick={() => setSelectedBadProducer(name)}
                                            disabled={selectedGoodProducer === name}
                                            className={`w-full text-left p-3 rounded-lg border flex justify-between items-center transition ${selectedBadProducer === name ? 'bg-red-900/40 border-red-500' : 'bg-dark-800 border-slate-700 hover:bg-slate-700 disabled:opacity-30'}`}
                                        >
                                            <span className="text-xs text-white truncate w-3/4">{name}</span>
                                            <span className="text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">{count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Good List */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-primary-400 uppercase border-b border-primary-500/30 pb-2">2. Destino (Correcto)</h4>
                                <div className="h-80 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                                    {producersList.map(([name, count]) => (
                                        <button 
                                            key={name} 
                                            onClick={() => setSelectedGoodProducer(name)}
                                            disabled={selectedBadProducer === name}
                                            className={`w-full text-left p-3 rounded-lg border flex justify-between items-center transition ${selectedGoodProducer === name ? 'bg-primary-900/40 border-primary-500' : 'bg-dark-800 border-slate-700 hover:bg-slate-700 disabled:opacity-30'}`}
                                        >
                                            <span className="text-xs text-white truncate w-3/4">{name}</span>
                                            <span className="text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">{count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Producer Merge Action */}
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center sticky bottom-0">
                            {selectedBadProducer && selectedGoodProducer ? (
                                <div className="animate-slide-up">
                                    <div className="flex items-center justify-center gap-2 mb-3 text-xs">
                                        <span className="text-red-400 font-bold line-through">{selectedBadProducer}</span>
                                        <Icon name="arrow_forward" className="text-slate-500" />
                                        <span className="text-primary-400 font-bold">{selectedGoodProducer}</span>
                                    </div>
                                    <button onClick={handleMergeProducers} className="bg-primary-600 px-6 py-3 rounded-xl font-bold text-white shadow-lg w-full flex items-center justify-center gap-2 active:scale-95 transition">
                                        <Icon name="auto_fix_high" /> Unificar Nombres
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">Selecciona origen y destino para corregir.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
