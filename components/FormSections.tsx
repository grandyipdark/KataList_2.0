
import React, { useMemo, useState } from 'react';
import { Tasting, FlavorProfile } from '../types';
import { Icon, SafeImage, SpeechMic, DebouncedColorPicker, FlavorWheel, TagInput } from './Shared';
import { useKataContext } from '../context/KataContext';
import { getFlavorGroups, getVisualGroups } from '../utils/flavorTags';
import { getProfileLabels } from '../utils/helpers';
import { generateReviewFromTags } from '../services/geminiService';

// --- HELPER COMPONENT (Legacy Text List) ---
const FlavorHelper = React.memo(({ category, onSelect, mode = 'flavor' }: { category: string, onSelect: (tag: string) => void, mode?: 'flavor' | 'visual' }) => {
    const [selectedGroup, setSelectedGroup] = React.useState<string | null>(null);
    const groups = mode === 'visual' ? getVisualGroups(category) : getFlavorGroups(category);
    return (
        <div className="bg-slate-100 dark:bg-dark-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-2 mb-3 animate-fade-in">
            <div className="flex items-center gap-2 mb-2 px-1"><Icon name={mode === 'visual' ? "visibility" : "palette"} className={`text-xs ${mode === 'visual' ? 'text-blue-500 dark:text-blue-400' : 'text-purple-500 dark:text-purple-400'}`} /><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Selector {mode === 'visual' ? 'Visual' : 'de Aromas'}</span></div>
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide mb-1">{groups.map(g => ( <button key={g.group} onClick={(e) => { e.preventDefault(); setSelectedGroup(selectedGroup === g.group ? null : g.group); }} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold border transition ${selectedGroup === g.group ? (mode === 'visual' ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-purple-600 text-white border-purple-500 shadow-md') : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{g.group}</button>))}</div>
            {selectedGroup && ( <div className="flex flex-wrap gap-2 p-2 bg-white dark:bg-dark-800 rounded-lg animate-fade-in border border-slate-200 dark:border-slate-700/50">{groups.find(g => g.group === selectedGroup)?.tags.map(tag => ( <button key={tag} onClick={(e) => { e.preventDefault(); onSelect(tag); }} className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 shadow-sm active:scale-95 transition">{tag}</button>))}</div> )}
        </div>
    );
});

// --- 1. MEDIA SECTION ---
interface MediaSectionProps {
    tasting: Tasting;
    setTasting: React.Dispatch<React.SetStateAction<Tasting>>;
    handleFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleGenImage: (prompt: string) => Promise<void>;
    handleEditImage: (index: number, instruction: string) => Promise<void>;
    isLoading: boolean;
}

export const MediaSection = React.memo(({ tasting, setTasting, handleFile, handleGenImage, handleEditImage, isLoading }: MediaSectionProps) => {
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [editImgIndex, setEditImgIndex] = React.useState<number | null>(null);
    const [editInstruction, setEditInstruction] = React.useState('');

    const handleSetCover = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (index === 0) return;
        setTasting(prev => {
            const newImages = [...prev.images];
            const [selectedImage] = newImages.splice(index, 1);
            newImages.unshift(selectedImage);
            return { ...prev, images: newImages };
        });
    };

    return (
        <>
            <div className="grid grid-cols-2 gap-2 mb-4">
                {tasting.images.map((img, i) => (
                    <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <SafeImage src={img} className="w-full h-full object-cover" alt="Tasting" />
                        {editImgIndex === i && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-2 z-20 animate-fade-in">
                                <input value={editInstruction} onChange={e => setEditInstruction(e.target.value)} placeholder="Ej: Quitar fondo" className="w-full text-xs bg-slate-800 p-1 rounded mb-2 text-white border border-slate-600" />
                                <div className="flex gap-2">
                                    <button onClick={() => setEditImgIndex(null)} className="text-xs text-slate-400 hover:text-white">Cancel</button>
                                    <button onClick={async () => { await handleEditImage(i, editInstruction); setEditImgIndex(null); setEditInstruction(''); }} className="text-xs bg-purple-600 px-2 py-1 rounded text-white">OK</button>
                                </div>
                            </div>
                        )}
                        <div className="absolute top-1 right-1 flex gap-1 bg-black/40 rounded-full p-0.5 backdrop-blur">
                            {i > 0 && <button onClick={(e) => handleSetCover(i, e)} className="bg-slate-800/80 text-yellow-400 p-1 rounded-full opacity-0 group-hover:opacity-100 transition"><Icon name="star" className="text-xs" /></button>}
                            <button onClick={() => { setEditImgIndex(i); setEditInstruction(''); }} className="bg-slate-800/80 text-purple-400 p-1 rounded-full opacity-0 group-hover:opacity-100 transition"><Icon name="auto_fix" className="text-xs" /></button>
                            <button onClick={() => setTasting(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))} className="bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"><Icon name="close" className="text-xs" /></button>
                        </div>
                        {i === 0 && <span className="absolute bottom-1 left-1 bg-primary-600 text-white text-[10px] px-1.5 rounded shadow-lg">Portada</span>}
                    </div>
                ))}
                <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <Icon name="add_a_photo" className="text-2xl mb-1" />
                    <span className="text-xs">Subir</span>
                    <input type="file" hidden accept="image/*" onChange={handleFile} />
                </label>
            </div>
            <div className="bg-slate-100 dark:bg-dark-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex gap-2">
                    <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Generar con IA (Vacío = Usar Nombre)" className="flex-1 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm" />
                    <button onClick={async () => { await handleGenImage(aiPrompt); setAiPrompt(''); }} disabled={isLoading} className="bg-purple-600 px-3 rounded-lg text-white"><Icon name="brush" /></button>
                </div>
            </div>
        </>
    );
});

// --- 2. MAIN SECTION ---
interface MainSectionProps {
    tasting: Tasting;
    handleChange: (field: keyof Tasting, value: any) => void;
    handleAutoFill: () => void;
    isLoading: boolean;
    possibleDuplicate: Tasting | undefined | null;
}

export const MainSection = React.memo(({ tasting, handleChange, handleAutoFill, isLoading, possibleDuplicate }: MainSectionProps) => {
    const { categories } = useKataContext();
    const categoryObj = categories.find(c => c.name === tasting.category);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                    <input value={tasting.name} onChange={e => handleChange('name', e.target.value)} placeholder="Nombre de la bebida" className="flex-1 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-primary-500" />
                    <button onClick={handleAutoFill} disabled={isLoading || !tasting.name} className="w-12 h-12 flex items-center justify-center bg-purple-600 rounded-xl text-white"><Icon name="auto_awesome" /></button>
                </div>
                {possibleDuplicate && ( <div className="text-yellow-600 dark:text-yellow-400 text-xs flex items-center gap-1 px-1 animate-fade-in"><Icon name="warning" className="text-sm" /> Posible duplicado de "{possibleDuplicate.name}"</div> )}
            </div>
            
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2"><Icon name="card_giftcard" className="text-purple-500 dark:text-purple-400" /><span className="text-sm text-slate-900 dark:text-white font-bold">Por Comprar / Wishlist</span></div>
                <button onClick={() => handleChange('isWishlist', !tasting.isWishlist)} className={`w-12 h-6 rounded-full relative transition-colors ${tasting.isWishlist ? 'bg-purple-600' : 'bg-slate-400 dark:bg-slate-600'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${tasting.isWishlist ? 'left-7' : 'left-1'}`}></div></button>
            </div>

            <div className="grid grid-cols-1"><input value={tasting.producer || ''} onChange={e => handleChange('producer', e.target.value)} placeholder="Productor / Bodega" className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" /></div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-slate-500 ml-1">Categoría</label>
                    <select value={tasting.category} onChange={e => handleChange('category', e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none appearance-none">
                        <option value="" disabled>Seleccionar...</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 ml-1">Estilo / Sub</label>
                    <input list="subcats_datalist" value={tasting.subcategory} onChange={e => handleChange('subcategory', e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" placeholder="Escribe o selecciona..." />
                    <datalist id="subcats_datalist">{categoryObj?.subcategories.map((s, i) => <option key={`${s}-${i}`} value={s} />)}</datalist>
                    {categoryObj && categoryObj.subcategories && categoryObj.subcategories.length > 0 && !tasting.subcategory && (<div className="flex flex-wrap gap-2 mt-2 animate-fade-in">{categoryObj.subcategories.map((s, i) => (<button type="button" key={`sub-btn-${s}-${i}`} onClick={() => handleChange('subcategory', s)} className={`text-[10px] px-2 py-1 rounded-full border transition active:scale-95 ${tasting.subcategory === s ? 'bg-primary-600 text-white border-primary-500 shadow' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{s}</button>))}</div>)}
                </div>
            </div>
            <div className="grid grid-cols-1"><input value={tasting.variety || ''} onChange={e => handleChange('variety', e.target.value)} placeholder="Uva / Variedad / Materia Prima" className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" /></div>
            <div className="grid grid-cols-2 gap-3"><input value={tasting.country} onChange={e => handleChange('country', e.target.value)} placeholder="País" className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" /><input value={tasting.region} onChange={e => handleChange('region', e.target.value)} placeholder="Región" className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" /></div>
        </div>
    );
});

// --- 3. TECH SECTION ---
interface TechSectionProps {
    tasting: Tasting;
    handleChange: (field: keyof Tasting, value: any) => void;
}

export const TechSection = React.memo(({ tasting, handleChange }: TechSectionProps) => {
    const { currency } = useKataContext();
    const vintageOptions = useMemo(() => { const years = ['NV']; const currentYear = new Date().getFullYear(); for (let i = currentYear; i >= 1900; i--) { years.push(i.toString()); } return years; }, []);
    
    // --- Aging Logic Handlers ---
    const currentYear = new Date().getFullYear();

    const handleBlurFrom = () => {
        if (!tasting.drinkFrom) return;
        const val = parseInt(tasting.drinkFrom);
        if (isNaN(val) || val < 1900) {
            handleChange('drinkFrom', currentYear.toString());
            if (!tasting.drinkTo) handleChange('drinkTo', currentYear.toString());
        } else {
            if (tasting.drinkTo && parseInt(tasting.drinkTo) < val) {
                handleChange('drinkTo', val.toString());
            }
        }
    };

    const handleBlurTo = () => {
        if (!tasting.drinkTo) return;
        const val = parseInt(tasting.drinkTo);
        const fromVal = parseInt(tasting.drinkFrom || currentYear.toString());
        if (isNaN(val) || val < fromVal) {
            handleChange('drinkTo', fromVal.toString());
        }
    };

    // --- ABV Validation Handler ---
    const handleAbvBlur = () => {
        if (!tasting.abv) return;
        let val = parseFloat(tasting.abv.toString().replace(',', '.'));
        if (isNaN(val)) { handleChange('abv', ''); return; }
        if (val < 0) val = 0;
        if (val > 100) val = 100;
        val = Math.round(val * 100) / 100;
        handleChange('abv', val.toString());
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="text-[10px] text-slate-500">Añada</label>
                    <select value={tasting.vintage || ''} onChange={e => handleChange('vintage', e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none appearance-none">
                        <option value="" disabled>...</option>
                        {vintageOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] text-slate-500">ABV</label>
                    <input 
                        type="number" inputMode="decimal" pattern="[0-9]*" step="0.1"
                        value={tasting.abv} 
                        onChange={e => handleChange('abv', e.target.value)}
                        onBlur={handleAbvBlur}
                        placeholder="%" 
                        className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" 
                    />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500">Precio ({currency})</label>
                    <input 
                        type="number" inputMode="decimal" pattern="[0-9]*"
                        value={tasting.price} 
                        onChange={e => handleChange('price', e.target.value)} 
                        placeholder={currency} 
                        className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" 
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] text-slate-500">Lote</label>
                    <input value={tasting.batch || ''} onChange={e => handleChange('batch', e.target.value)} placeholder="Lote" className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500">Stock (Botellas)</label>
                    <div className="flex items-center h-[46px] bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 px-2 gap-2">
                        <button onClick={() => handleChange('stock', Math.max(0, (tasting.stock||0)-1))} className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white flex items-center justify-center">-</button>
                        <input 
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            value={tasting.stock || 0} 
                            onChange={e => handleChange('stock', parseInt(e.target.value) || 0)} 
                            className="flex-1 text-center font-bold text-slate-900 dark:text-white bg-transparent outline-none w-full"
                        />
                        <button onClick={() => handleChange('stock', (tasting.stock||0)+1)} className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">+</button>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1"><div><label className="text-[10px] text-slate-500">Lugar Compra</label><input value={tasting.location || ''} onChange={e => handleChange('location', e.target.value)} placeholder="Tienda, Restaurante..." className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" /></div></div>
            <div className="bg-slate-100 dark:bg-dark-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800"><h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Potencial de Guarda</h4>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] text-slate-500">Desde</label>
                        <input 
                            type="number" 
                            pattern="[0-9]*" 
                            value={tasting.drinkFrom || ''} 
                            onChange={e => handleChange('drinkFrom', e.target.value)} 
                            onBlur={handleBlurFrom}
                            placeholder={currentYear.toString()} 
                            className="w-full bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" 
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500">Hasta</label>
                        <input 
                            type="number" 
                            pattern="[0-9]*" 
                            value={tasting.drinkTo || ''} 
                            onChange={e => handleChange('drinkTo', e.target.value)} 
                            onBlur={handleBlurTo}
                            placeholder={currentYear.toString()} 
                            className="w-full bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

// --- 4. SENSORY & NOTES SECTION ---
interface SensorySectionProps {
    tasting: Tasting;
    handleChange: (field: keyof Tasting, value: any) => void;
    handleProfileChange: (p: keyof FlavorProfile, v: number) => void;
    handleAnalyzeNotes: () => void;
    handleDictation: (field: keyof Tasting, text: string) => void;
    isLoading: boolean;
}

export const SensorySection = React.memo(({ tasting, handleChange, handleProfileChange, handleAnalyzeNotes, handleDictation, isLoading }: SensorySectionProps) => {
    const [activeFieldForHelper, setActiveFieldForHelper] = useState<'visual' | 'aroma' | 'taste' | null>(null);
    const [showFlavorWheel, setShowFlavorWheel] = useState(false);
    const { showToast, scoreScale, formatScore, allTags } = useKataContext();
    const [isGeneratingReview, setIsGeneratingReview] = useState(false);
    const profileLabels = getProfileLabels(tasting.category);

    const appendFlavorTag = (tag: string) => { 
        // 1. Always update Tags (Structural Data)
        const newTags = [...tasting.tags];
        if(!newTags.includes(tag)) newTags.push(tag);
        handleChange('tags', newTags);

        // 2. Append to Text Field (User Feedback)
        const targetField = activeFieldForHelper || 'aroma'; 
        const currentVal = (tasting[targetField] as string) || '';
        if (!currentVal.toLowerCase().includes(tag.toLowerCase())) {
             const separator = currentVal.trim().length > 0 && !currentVal.trim().endsWith(', ') ? ', ' : '';
             handleChange(targetField, currentVal + separator + tag);
        }
    };

    const handleAddTag = (tag: string) => {
        if (!tasting.tags.includes(tag)) {
            handleChange('tags', [...tasting.tags, tag]);
        }
    };

    const handleRemoveTag = (tag: string) => {
        handleChange('tags', tasting.tags.filter(t => t !== tag));
    };

    const handleGenerateReview = async () => {
        if (tasting.tags.length < 3) {
            showToast("Selecciona al menos 3 etiquetas primero", "error");
            return;
        }
        setIsGeneratingReview(true);
        showToast("La IA está escribiendo...", "info");
        try {
            const review = await generateReviewFromTags(tasting);
            handleChange('notes', review);
            showToast("Reseña generada", "success");
        } catch (e: any) {
            showToast(`Vuelve a intentarlo. ${e.message || "Error generando reseña"}`, "error");
        }
        setIsGeneratingReview(false);
    };

    return (
        <div className="space-y-6">
            {!tasting.isWishlist && (
                <div className="space-y-4">
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Puntuación ({scoreScale === '5' ? '5 Estrellas' : scoreScale === '100' ? '100 Pts' : '10 Pts'})</span>
                            <span className={`text-xl font-bold ${tasting.score >= 8 ? 'text-green-500 dark:text-green-400' : 'text-yellow-500 dark:text-yellow-400'}`}>{formatScore(tasting.score)}</span>
                        </div>
                        
                        {scoreScale === '5' ? (
                            <div className="flex justify-between px-2">
                                {[2, 4, 6, 8, 10].map(starVal => (
                                    <button 
                                        key={starVal}
                                        onClick={() => handleChange('score', starVal)}
                                        className={`text-3xl transition ${tasting.score >= starVal ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600'}`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                        ) : scoreScale === '100' ? (
                            <input type="range" min="50" max="100" step="1" value={Math.max(50, tasting.score * 10)} onChange={e => handleChange('score', parseFloat(e.target.value) / 10)} className="w-full accent-primary-500 h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        ) : (
                            <input type="range" min="0" max="10" step="0.1" value={tasting.score} onChange={e => handleChange('score', parseFloat(e.target.value))} className="w-full accent-primary-500 h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        )}

                        <div className="mt-4 flex items-center justify-between"><span className="text-sm text-slate-600 dark:text-slate-300">Marcar Favorito</span><button onClick={() => handleChange('isFavorite', !tasting.isFavorite)} className={`w-12 h-8 rounded-full flex items-center px-1 transition ${tasting.isFavorite ? 'bg-yellow-500 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'}`}><div className="w-6 h-6 rounded-full bg-white shadow-sm" /></button></div>
                    </div>
                    <div className="bg-slate-50 dark:bg-dark-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800"><h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase text-center">Perfil Sensorial</h3><div className="space-y-4">{profileLabels.map((label, i) => { const key = `p${i+1}` as keyof FlavorProfile; const val = tasting.profile?.[key] || 3; return ( <div key={key} className="flex items-center gap-3"><span className="w-20 text-xs text-slate-500 dark:text-slate-400 text-right">{label}</span><input type="range" min="1" max="5" step="1" value={val} onChange={e => handleProfileChange(key, parseInt(e.target.value))} className="flex-1 accent-purple-500 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none" /><span className="w-4 text-xs font-bold text-slate-700 dark:text-slate-300">{val}</span></div> ) })}</div></div>
                </div>
            )}

            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                {/* Visual Field - Uses Old List Selector */}
                <div className="relative">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 ml-1">Visual</label>
                            <SpeechMic onResult={(t) => handleDictation('visual', t)} />
                        </div>
                        <button onClick={(e) => { e.preventDefault(); setActiveFieldForHelper(activeFieldForHelper === 'visual' ? null : 'visual'); }} className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition ${activeFieldForHelper === 'visual' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-blue-600 dark:text-blue-400'}`}>{activeFieldForHelper === 'visual' ? 'Cerrar' : '+ Selector'}</button>
                    </div>
                    {activeFieldForHelper === 'visual' && <FlavorHelper category={tasting.category} mode='visual' onSelect={appendFlavorTag} />}
                    <textarea value={tasting.visual} onChange={e => handleChange('visual', e.target.value)} placeholder="Color, brillo, lágrima..." className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none min-h-[60px]" />
                </div>

                {/* NEW FLAVOR WHEEL INTEGRATION */}
                <div className="bg-slate-50 dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1">
                    <button 
                        onClick={(e) => { e.preventDefault(); setShowFlavorWheel(!showFlavorWheel); }} 
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition ${showFlavorWheel ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                    >
                        <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                            <Icon name="palette" className="text-primary-500" /> Rueda de Aromas
                        </span>
                        <Icon name={showFlavorWheel ? "expand_less" : "expand_more"} className="text-slate-400" />
                    </button>
                    
                    {showFlavorWheel && (
                        <div className="p-4 bg-slate-100 dark:bg-slate-900/50 animate-slide-up">
                            <FlavorWheel onSelectTag={appendFlavorTag} />
                            <p className="text-[10px] text-center text-slate-500 mt-2">Toca para profundizar • Centro para volver</p>
                        </div>
                    )}
                </div>

                {/* Aroma & Taste Text Areas (Manual Input) */}
                {['aroma', 'taste'].map(field => (
                    <div key={field} className="relative">
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-500 ml-1 capitalize">{field === 'aroma' ? 'Aroma' : 'Gusto'}</label>
                                <SpeechMic onResult={(t) => handleDictation(field as keyof Tasting, t)} />
                            </div>
                        </div>
                        <textarea value={tasting[field as keyof Tasting] as string} onChange={e => handleChange(field as keyof Tasting, e.target.value)} placeholder={`Notas de ${field}...`} className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none min-h-[80px]" />
                    </div>
                ))}

                <div className="flex items-center gap-2 border border-slate-300 dark:border-slate-700 p-2 rounded-xl"><Icon name="restaurant" className="text-slate-500" /><input value={tasting.pairing || ''} onChange={e => handleChange('pairing', e.target.value)} placeholder="Maridaje sugerido" className="flex-1 bg-transparent text-slate-900 dark:text-white outline-none text-sm" /></div>
                
                <div className="relative">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 ml-1">Conclusiones</label>
                            <SpeechMic onResult={(t) => handleDictation('notes', t)} />
                        </div>
                        <button 
                            onClick={handleGenerateReview} 
                            disabled={isGeneratingReview || isLoading}
                            className="text-[10px] font-bold bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-500/30 flex items-center gap-1 hover:bg-primary-200 dark:hover:bg-primary-900 transition disabled:opacity-50"
                        >
                            {isGeneratingReview ? <span className="animate-spin">⌛</span> : <Icon name="psychology" className="text-xs" />}
                            Redactar con IA
                        </button>
                    </div>
                    <textarea value={tasting.notes} onChange={e => handleChange('notes', e.target.value)} placeholder="Conclusiones personales..." className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none min-h-[80px]" />
                </div>
                
                <button onClick={handleAnalyzeNotes} disabled={isLoading} className="w-full py-2 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 border border-blue-200 dark:border-blue-500/30 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-200 flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition">{isLoading ? <span className="animate-spin">⌛</span> : <Icon name="auto_fix" />} ✨ Analizar e Interpretar Notas</button>

                <div>
                    <label className="text-xs text-slate-500 ml-1 mb-1 block">Etiquetas Seleccionadas</label>
                    <TagInput 
                        tags={tasting.tags} 
                        onAddTag={handleAddTag} 
                        onRemoveTag={handleRemoveTag} 
                        allTags={allTags}
                    />
                </div>
            </div>
        </div>
    );
});
