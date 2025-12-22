
import React, { useMemo, useState } from 'react';
import { Tasting, FlavorProfile } from '../types';
import { Icon, SafeImage, SpeechMic, FlavorWheel, TagInput } from './Shared';
import { useKataContext } from '../context/KataContext';
import { getFlavorGroups, getVisualGroups } from '../utils/flavorTags';
import { getProfileLabels } from '../utils/helpers';
import { generateReviewFromTags } from '../services/geminiService';

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
            <div className="grid grid-cols-3 gap-2 mb-4">
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
                            <button onClick={() => { setEditImgIndex(i); setEditInstruction(''); }} className="bg-slate-800/80 text-purple-400 p-1 rounded-full"><Icon name="auto_fix" className="text-xs" /></button>
                            <button onClick={() => setTasting(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))} className="bg-red-600 text-white p-1 rounded-full"><Icon name="close" className="text-xs" /></button>
                        </div>
                        {i === 0 && <span className="absolute bottom-1 left-1 bg-primary-600 text-white text-[8px] px-1 rounded shadow-lg uppercase font-bold">Portada</span>}
                    </div>
                ))}
                
                {/* Botón Cámara */}
                <label className="aspect-square rounded-xl border-2 border-dashed border-primary-500/50 bg-primary-500/5 flex flex-col items-center justify-center text-primary-500 hover:bg-primary-500/10 cursor-pointer active:scale-95 transition">
                    <Icon name="photo_camera" className="text-2xl mb-1" />
                    <span className="text-[10px] font-bold uppercase">Cámara</span>
                    <input type="file" hidden accept="image/*" capture="environment" onChange={handleFile} />
                </label>

                {/* Botón Galería */}
                <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer active:scale-95 transition">
                    <Icon name="collections" className="text-2xl mb-1" />
                    <span className="text-[10px] font-bold uppercase">Galería</span>
                    <input type="file" hidden accept="image/*" onChange={handleFile} />
                </label>
            </div>
            
            <div className="bg-slate-100 dark:bg-dark-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex gap-2">
                    <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Generar con IA (vacío = usar nombre)" className="flex-1 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs" />
                    <button onClick={async () => { await handleGenImage(aiPrompt); setAiPrompt(''); }} disabled={isLoading} className="bg-purple-600 px-3 rounded-lg text-white active:scale-95 transition flex items-center justify-center min-w-[44px]">
                        {isLoading ? <span className="animate-spin text-sm">⌛</span> : <Icon name="brush" />}
                    </button>
                </div>
                <p className="text-[9px] text-slate-500 mt-2 text-center">La generación IA consume créditos de tu plan de Google Cloud.</p>
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
                    <button onClick={handleAutoFill} disabled={isLoading || !tasting.name} className="w-12 h-12 flex items-center justify-center bg-purple-600 rounded-xl text-white active:scale-95 transition">
                        {isLoading ? <span className="animate-spin">⌛</span> : <Icon name="auto_awesome" />}
                    </button>
                </div>
                {possibleDuplicate && ( <div className="text-yellow-600 dark:text-yellow-400 text-[10px] flex items-center gap-1 px-1 animate-fade-in"><Icon name="warning" className="text-xs" /> Posible duplicado de "{possibleDuplicate.name}"</div> )}
            </div>
            
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2"><Icon name="card_giftcard" className="text-purple-500 dark:text-purple-400" /><span className="text-sm text-slate-900 dark:text-white font-bold">Lista de Deseos</span></div>
                <button onClick={() => handleChange('isWishlist', !tasting.isWishlist)} className={`w-12 h-6 rounded-full relative transition-colors ${tasting.isWishlist ? 'bg-purple-600' : 'bg-slate-400 dark:bg-slate-600'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${tasting.isWishlist ? 'left-7' : 'left-1'}`}></div></button>
            </div>

            <input value={tasting.producer || ''} onChange={e => handleChange('producer', e.target.value)} placeholder="Productor / Bodega" className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" />
            
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] text-slate-500 ml-1">Categoría</label>
                    <select value={tasting.category} onChange={e => handleChange('category', e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none appearance-none">
                        <option value="" disabled>Seleccionar...</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 ml-1">Estilo</label>
                    <input list="subcats_datalist" value={tasting.subcategory} onChange={e => handleChange('subcategory', e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" placeholder="Tipo..." />
                    <datalist id="subcats_datalist">{categoryObj?.subcategories.map((s, i) => <option key={`${s}-${i}`} value={s} />)}</datalist>
                </div>
            </div>
            <input value={tasting.variety || ''} onChange={e => handleChange('variety', e.target.value)} placeholder="Variedad (Uva, Lúpulo, Grano...)" className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" />
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
    const currentYear = new Date().getFullYear();

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
                    <label className="text-[10px] text-slate-500">ABV %</label>
                    <input type="number" inputMode="decimal" value={tasting.abv} onChange={e => handleChange('abv', e.target.value)} placeholder="%" className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500">Precio ({currency})</label>
                    <input type="number" inputMode="decimal" value={tasting.price} onChange={e => handleChange('price', e.target.value)} placeholder={currency} className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <input value={tasting.batch || ''} onChange={e => handleChange('batch', e.target.value)} placeholder="Lote / Botella" className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" />
                <div className="flex items-center h-[46px] bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 px-2 gap-2">
                    <button onClick={() => handleChange('stock', Math.max(0, (tasting.stock||0)-1))} className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white flex items-center justify-center">-</button>
                    <input type="number" value={tasting.stock || 0} onChange={e => handleChange('stock', parseInt(e.target.value) || 0)} className="flex-1 text-center font-bold text-slate-900 dark:text-white bg-transparent outline-none w-8" />
                    <button onClick={() => handleChange('stock', (tasting.stock||0)+1)} className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">+</button>
                </div>
            </div>
            <input value={tasting.location || ''} onChange={e => handleChange('location', e.target.value)} placeholder="Lugar de Compra / Consumo" className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none" />
            <div className="bg-slate-100 dark:bg-dark-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Potencial de Guarda</h4>
                <div className="grid grid-cols-2 gap-3">
                    <input type="number" value={tasting.drinkFrom || ''} onChange={e => handleChange('drinkFrom', e.target.value)} placeholder={`Desde (${currentYear})`} className="w-full bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none text-xs" />
                    <input type="number" value={tasting.drinkTo || ''} onChange={e => handleChange('drinkTo', e.target.value)} placeholder="Hasta" className="w-full bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none text-xs" />
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
    const [showFlavorWheel, setShowFlavorWheel] = useState(false);
    const { showToast, scoreScale, formatScore, allTags } = useKataContext();
    const [isGeneratingReview, setIsGeneratingReview] = useState(false);
    const profileLabels = getProfileLabels(tasting.category);

    const appendFlavorTag = (tag: string) => { 
        const newTags = [...tasting.tags];
        if(!newTags.includes(tag)) newTags.push(tag);
        handleChange('tags', newTags);
        showToast(`Añadido: ${tag}`, 'info');
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
        try {
            const review = await generateReviewFromTags(tasting);
            handleChange('notes', review);
            showToast("Reseña generada", "success");
        } catch (e: any) {
            showToast("Error redactando", "error");
        }
        setIsGeneratingReview(false);
    };

    return (
        <div className="space-y-6">
            {!tasting.isWishlist && (
                <div className="space-y-4">
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Puntuación</span>
                            <span className={`text-xl font-bold ${tasting.score >= 8 ? 'text-green-500' : 'text-yellow-500'}`}>{formatScore(tasting.score)}</span>
                        </div>
                        <input type="range" min="0" max="10" step="0.1" value={tasting.score} onChange={e => handleChange('score', parseFloat(e.target.value))} className="w-full accent-primary-500 h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        <div className="mt-4 flex items-center justify-between"><span className="text-sm text-slate-600 dark:text-slate-300">Favorito</span><button onClick={() => handleChange('isFavorite', !tasting.isFavorite)} className={`w-12 h-7 rounded-full flex items-center px-1 transition ${tasting.isFavorite ? 'bg-yellow-500 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'}`}><div className="w-5 h-5 rounded-full bg-white shadow-sm" /></button></div>
                    </div>
                    <div className="bg-slate-50 dark:bg-dark-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                        <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase text-center">Perfil de Estructura</h3>
                        <div className="space-y-4">{profileLabels.map((label, i) => { const key = `p${i+1}` as keyof FlavorProfile; const val = tasting.profile?.[key] || 3; return ( <div key={key} className="flex items-center gap-3"><span className="w-20 text-[10px] text-slate-500 uppercase text-right">{label}</span><input type="range" min="1" max="5" step="1" value={val} onChange={e => handleProfileChange(key, parseInt(e.target.value))} className="flex-1 accent-purple-500 h-1 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none" /><span className="w-4 text-xs font-bold text-slate-700 dark:text-slate-300">{val}</span></div> ) })}</div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1">
                    <button onClick={(e) => { e.preventDefault(); setShowFlavorWheel(!showFlavorWheel); }} className="w-full flex items-center justify-between p-3 rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider"><Icon name="palette" className="text-primary-500" /> Rueda de Aromas IA</span>
                        <Icon name={showFlavorWheel ? "expand_less" : "expand_more"} className="text-slate-400" />
                    </button>
                    {showFlavorWheel && (
                        <div className="p-4 bg-slate-100 dark:bg-slate-900/50 animate-slide-up">
                            <FlavorWheel onSelectTag={appendFlavorTag} />
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    {['visual', 'aroma', 'taste', 'notes'].map(field => (
                        <div key={field} className="relative">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase">{field === 'notes' ? 'Conclusiones' : field}</label>
                                <SpeechMic onResult={(t) => handleDictation(field as keyof Tasting, t)} />
                            </div>
                            <textarea value={tasting[field as keyof Tasting] as string} onChange={e => handleChange(field as keyof Tasting, e.target.value)} placeholder={`Notas de ${field}...`} className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none min-h-[60px] text-sm" />
                        </div>
                    ))}
                </div>
                
                <button onClick={handleAnalyzeNotes} disabled={isLoading} className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition shadow-lg">
                    {isLoading ? <span className="animate-spin text-sm">⌛</span> : <Icon name="auto_fix" />} Analizar Notas con IA
                </button>

                <div className="pt-2">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Etiquetas</label>
                        <button onClick={handleGenerateReview} disabled={isGeneratingReview || isLoading} className="text-[9px] font-bold text-primary-500 uppercase flex items-center gap-1">
                            {isGeneratingReview ? 'Escribiendo...' : 'Redactar reseña IA'}
                        </button>
                    </div>
                    <TagInput tags={tasting.tags} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} allTags={allTags} />
                </div>
            </div>
        </div>
    );
});
