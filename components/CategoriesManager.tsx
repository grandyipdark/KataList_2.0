
import React, { useState, useMemo } from 'react';
import { useKataContext } from '../context/KataContext';
import { Category } from '../types';
import { Icon, ConfirmModal, InputModal, IconPickerModal, DebouncedColorPicker } from './Shared';
import { suggestSubcategories } from '../services/geminiService';

export const CategoriesManager = React.memo(() => {
    const { categories, updateCategories, showToast, tastings, updateTags, optimizeTagsBulk } = useKataContext();
    const [activeTab, setActiveTab] = useState<'CATS'|'TAGS'>('CATS');
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [newInput, setNewInput] = useState('');
    const [newColor, setNewColor] = useState('#a855f7');
    const [newIcon, setNewIcon] = useState('label');
    const [isLoading, setIsLoading] = useState(false);
    const [modalAction, setModalAction] = useState<{ type: 'RENAME_CAT' | 'RENAME_SUB' | 'RENAME_TAG' | 'DELETE_CAT' | 'DELETE_SUB' | 'DELETE_TAG', itemId: string, itemName: string, parentId?: string } | null>(null);
    const [iconPickerOpen, setIconPickerOpen] = useState(false);
    const [iconPickerTarget, setIconPickerTarget] = useState<string | null>(null); // null = new category, string = category id
    const [optimizeModalOpen, setOptimizeModalOpen] = useState(false);

    const allTags = useMemo(() => {
        const tags: Record<string, number> = {};
        tastings.forEach(t => t.tags.forEach(tag => tags[tag] = (tags[tag] || 0) + 1));
        return Object.entries(tags).sort((a,b) => b[1] - a[1]);
    }, [tastings]);

    const handleAddCat = () => { if (!newInput) return; updateCategories([...categories, { id: Date.now().toString(), name: newInput, subcategories: [], color: newColor, icon: newIcon }]); setNewInput(''); showToast("Categoría añadida", "success"); };
    
    const handleAddSubcat = () => { 
        if (!selectedCategory || !newInput) return;
        const normalizedInput = newInput.trim();
        // Prevent duplicate subcategories (fixes React duplicate key warnings)
        if (selectedCategory.subcategories.some(s => s.toLowerCase() === normalizedInput.toLowerCase())) {
            showToast("Ya existe esa subcategoría", "error");
            return;
        }
        
        const updatedCat = { ...selectedCategory, subcategories: [...selectedCategory.subcategories, normalizedInput] }; 
        updateCategories(categories.map(c => c.id === selectedCategory.id ? updatedCat : c)); 
        setSelectedCategory(updatedCat); 
        setNewInput(''); 
        showToast("Subcategoría añadida", "success"); 
    };

    const handleSuggestSubcats = async () => { if (!selectedCategory) return; setIsLoading(true); showToast("IA pensando...", "info"); try { const suggestions = await suggestSubcategories(selectedCategory.name); const merged = Array.from(new Set([...selectedCategory.subcategories, ...suggestions])); const updatedCat = { ...selectedCategory, subcategories: merged }; updateCategories(categories.map(c => c.id === selectedCategory.id ? updatedCat : c)); setSelectedCategory(updatedCat); showToast("Sugerencias añadidas", "success"); } catch(e: any) { showToast(`Vuelve a intentarlo. ${e.message || "Error al sugerir"}`, "error"); } setIsLoading(false); };
    const handleUpdateColor = (cat: Category, color: string) => { const updatedCat = { ...cat, color }; updateCategories(categories.map(c => c.id === cat.id ? updatedCat : c)); if (selectedCategory?.id === cat.id) setSelectedCategory(updatedCat); };
    const handleUpdateIcon = (icon: string) => {
        if (iconPickerTarget) {
            // Edit existing
            const updatedCat = categories.find(c => c.id === iconPickerTarget);
            if (updatedCat) {
                const newCat = { ...updatedCat, icon };
                updateCategories(categories.map(c => c.id === iconPickerTarget ? newCat : c));
                if (selectedCategory?.id === iconPickerTarget) setSelectedCategory(newCat);
                showToast("Icono actualizado", "success");
            }
        } else {
            // New category
            setNewIcon(icon);
        }
        setIconPickerOpen(false);
    };

    const confirmAction = () => {
        if (!modalAction) return;
        const { type, itemId } = modalAction;
        if (type === 'DELETE_CAT') { updateCategories(categories.filter(c => c.id !== itemId)); if (selectedCategory?.id === itemId) setSelectedCategory(null); showToast("Categoría eliminada", "success"); }
        else if (type === 'DELETE_SUB' && selectedCategory) { const updatedCat = { ...selectedCategory, subcategories: selectedCategory.subcategories.filter(s => s !== itemId) }; updateCategories(categories.map(c => c.id === selectedCategory.id ? updatedCat : c)); setSelectedCategory(updatedCat); showToast("Subcategoría eliminada", "success"); }
        else if (type === 'DELETE_TAG') { updateTags(itemId, null); }
        setModalAction(null);
    };

    const confirmRename = (newValue: string) => {
         if (!modalAction || !newValue) return;
         const { type, itemId, itemName } = modalAction;
         if (newValue === itemName) { setModalAction(null); return; }
         if (type === 'RENAME_CAT') { updateCategories(categories.map(c => c.id === itemId ? { ...c, name: newValue } : c)); if (selectedCategory?.id === itemId) setSelectedCategory({ ...selectedCategory, name: newValue }); showToast("Renombrado", "success"); }
         else if (type === 'RENAME_SUB' && selectedCategory) { const updatedSubs = selectedCategory.subcategories.map(s => s === itemId ? newValue : s); const updatedCat = { ...selectedCategory, subcategories: updatedSubs }; updateCategories(categories.map(c => c.id === selectedCategory.id ? updatedCat : c)); setSelectedCategory(updatedCat); showToast("Renombrado", "success"); }
         else if (type === 'RENAME_TAG') { updateTags(itemId, newValue); }
         setModalAction(null);
    };

    const executeOptimization = async () => {
        setOptimizeModalOpen(false);
        setIsLoading(true);
        // Toast is handled inside context, but setting loading state here is good UI practice
        try {
            await optimizeTagsBulk();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pb-24 p-4 space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold font-serif mb-4">Gestión de Datos</h2>
            <div className="flex gap-2 mb-4 bg-dark-800 p-1 rounded-xl">
                <button onClick={() => { setActiveTab('CATS'); setSelectedCategory(null); }} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'CATS' ? 'bg-slate-700 text-white shadow' : 'text-slate-500'}`}>Categorías</button>
                <button onClick={() => { setActiveTab('TAGS'); setSelectedCategory(null); }} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'TAGS' ? 'bg-slate-700 text-white shadow' : 'text-slate-500'}`}>Etiquetas</button>
            </div>
            
            <ConfirmModal isOpen={!!modalAction && modalAction.type.startsWith('DELETE')} title="Eliminar Elemento" message={`¿Estás seguro de eliminar "${modalAction?.itemName}"?`} onConfirm={confirmAction} onCancel={() => setModalAction(null)} />
            <InputModal isOpen={!!modalAction && modalAction.type.startsWith('RENAME')} title={`Renombrar ${modalAction?.itemName}`} initialValue={modalAction?.itemName || ''} onConfirm={confirmRename} onCancel={() => setModalAction(null)} />
            <IconPickerModal isOpen={iconPickerOpen} onSelect={handleUpdateIcon} onCancel={() => setIconPickerOpen(false)} />
            
            {/* Optimization Confirm Modal */}
            <ConfirmModal 
                isOpen={optimizeModalOpen} 
                title="Optimización IA" 
                message="Esto analizará todas tus etiquetas para unificar duplicados (ej: 'Café' y 'Cafe') y corregir ortografía. ¿Deseas continuar?" 
                onConfirm={executeOptimization} 
                onCancel={() => setOptimizeModalOpen(false)} 
            />

            {activeTab === 'CATS' && !selectedCategory && (
                <div className="space-y-3">
                    <div className="space-y-2">{categories.map(c => ( <div key={c.id} onClick={() => setSelectedCategory(c)} className="flex items-center justify-between bg-dark-800 p-3 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800 transition active:scale-[0.99]"><div className="flex items-center gap-3"><div className="relative w-8 h-8 rounded-lg flex items-center justify-center text-lg bg-slate-700/50 cursor-pointer group" style={{ color: c.color }}><button onClick={(e) => { e.stopPropagation(); setIconPickerTarget(c.id); setIconPickerOpen(true); }} className="absolute inset-0 flex items-center justify-center z-10"><Icon name={c.icon || 'label'} /></button><DebouncedColorPicker className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-slate-900 z-20" value={c.color || '#a855f7'} onChange={(val) => handleUpdateColor(c, val)} /></div><div><span className="font-medium text-white block">{c.name}</span><span className="text-[10px] text-slate-500">{c.subcategories.length} estilos</span></div></div><div className="flex gap-2"><button type="button" onClick={(e) => { e.stopPropagation(); setModalAction({ type: 'RENAME_CAT', itemId: c.id, itemName: c.name }); }} className="p-2 text-blue-400 bg-slate-700/50 hover:bg-slate-600 rounded-lg"><Icon name="edit" className="text-sm" /></button><button type="button" onClick={(e) => { e.stopPropagation(); setModalAction({ type: 'DELETE_CAT', itemId: c.id, itemName: c.name }); }} className="p-2 text-red-400 bg-slate-700/50 hover:bg-slate-600 rounded-lg"><Icon name="delete" className="text-sm" /></button><Icon name="chevron_right" className="text-slate-500" /></div></div> ))}</div>
                    <div className="flex gap-2 mt-4 animate-slide-up items-center">
                        <button onClick={() => { setIconPickerTarget(null); setIconPickerOpen(true); }} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center cursor-pointer text-slate-300 hover:text-white"><Icon name={newIcon} /></button>
                        <div className="relative w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center cursor-pointer overflow-hidden"><input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={newColor} onChange={(e) => setNewColor(e.target.value)} /><div className="w-6 h-6 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: newColor }}></div></div>
                        <input value={newInput} onChange={e => setNewInput(e.target.value)} placeholder="Nueva Categoría" className="flex-1 bg-dark-800 p-3 rounded-xl border border-slate-700 outline-none text-white" /><button onClick={handleAddCat} className="bg-blue-600 px-4 h-12 rounded-xl text-white font-bold flex items-center justify-center"><Icon name="add" /></button>
                    </div>
                </div>
            )}
            {activeTab === 'CATS' && selectedCategory && (
                <div className="space-y-4 animate-slide-up">
                    <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-2 text-slate-400 text-sm mb-2 hover:text-white"><Icon name="arrow_back" /> Volver a Categorías</button>
                    <div className="flex items-center justify-between bg-dark-900 p-4 rounded-xl border border-slate-800"><div className="flex items-center gap-3"><span className="text-2xl" style={{ color: selectedCategory.color }}><Icon name={selectedCategory.icon || 'label'} /></span><h3 className="text-xl font-bold text-white">{selectedCategory.name}</h3></div></div>
                    <div className="bg-dark-800 rounded-xl border border-slate-800 p-4"><h4 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Subcategorías</h4><div className="flex flex-wrap gap-2 mb-4">{selectedCategory.subcategories.map((sub, idx) => ( <div key={`${sub}-${idx}`} onClick={() => setModalAction({ type: 'RENAME_SUB', itemId: sub, itemName: sub })} className="bg-slate-700 px-3 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-slate-600 border border-transparent hover:border-slate-500 transition"><span className="text-sm text-white">{sub}</span><button onClick={(e) => { e.stopPropagation(); setModalAction({ type: 'DELETE_SUB', itemId: sub, itemName: sub }); }} className="text-slate-400 hover:text-red-400 p-1 rounded-full hover:bg-slate-800/50"><Icon name="close" className="text-xs" /></button></div> ))}{selectedCategory.subcategories.length === 0 && <span className="text-slate-500 italic text-sm">Sin subcategorías definidas</span>}</div><div className="flex gap-2 mb-2"><input value={newInput} onChange={e => setNewInput(e.target.value)} placeholder="Nuevo Estilo" className="flex-1 bg-slate-900 p-2 rounded-lg border border-slate-600 outline-none text-white text-sm" /><button onClick={handleAddSubcat} className="bg-blue-600 px-3 rounded-lg text-white text-sm">OK</button></div><button onClick={handleSuggestSubcats} disabled={isLoading} className="w-full py-2 bg-purple-600 rounded-lg text-sm text-white hover:bg-purple-500 transition flex items-center justify-center gap-1">{isLoading ? <span className="animate-spin">⌛</span> : <Icon name="auto_awesome" className="text-xs" />} Sugerir con IA</button></div>
                </div>
            )}
            {activeTab === 'TAGS' && (
                <div className="space-y-3">
                    <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 p-4 rounded-xl border border-blue-500/20 mb-4 flex items-center justify-between"><div><h4 className="font-bold text-blue-200 text-sm">Mantenimiento IA</h4><p className="text-[10px] text-blue-300/70">Unificar duplicados y corregir ortografía.</p></div><button onClick={() => setOptimizeModalOpen(true)} disabled={isLoading} className="bg-blue-600 px-3 py-2 rounded-lg text-white text-xs font-bold shadow-lg hover:bg-blue-500 transition flex items-center gap-2">{isLoading ? '...' : <><Icon name="auto_fix" /> Optimizar</>}</button></div>
                    {allTags.length === 0 && <p className="text-center text-slate-500 py-8">No hay etiquetas usadas aún.</p>}
                    {allTags.map(([tag, count]) => ( <div key={tag} className="flex items-center justify-between bg-dark-800 p-3 rounded-xl border border-slate-800"><div className="flex items-center gap-2"><Icon name="label" className="text-slate-500 text-sm" /><span className="text-white font-medium">{tag}</span><span className="bg-slate-700 text-slate-300 text-[10px] px-1.5 rounded-full">{count}</span></div><div className="flex gap-2"><button onClick={() => setModalAction({ type: 'RENAME_TAG', itemId: tag, itemName: tag })} className="p-2 text-blue-400 bg-slate-900 rounded-lg hover:bg-slate-800"><Icon name="edit" className="text-sm" /></button><button onClick={() => setModalAction({ type: 'DELETE_TAG', itemId: tag, itemName: tag })} className="p-2 text-red-400 bg-slate-900 rounded-lg hover:bg-slate-800"><Icon name="delete" className="text-sm" /></button></div></div> ))}
                </div>
            )}
        </div>
    );
});
