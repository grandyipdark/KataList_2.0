
import { useState, useCallback } from 'react';
import { Tasting, Category, UserList, DEFAULT_CATEGORIES, ViewState } from '../types';
import { storageService } from '../services/storageService';
import { vibrate } from '../utils/helpers';
import { optimizeTagList, TagCorrection } from '../services/geminiService';

export const useTastingData = (showToast: (msg: string, type: 'success' | 'error' | 'info') => void, setView: (v: ViewState) => void) => {
    const [tastings, setTastings] = useState<Tasting[]>([]);
    const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
    const [userLists, setUserLists] = useState<UserList[]>([]);
    const [selectedTasting, setSelectedTasting] = useState<Tasting | null>(null);
    const [compareList, setCompareList] = useState<string[]>([]);
    
    const refreshData = useCallback(async () => {
        const t = await storageService.getTastings();
        const c = await storageService.getCategories();
        const l = await storageService.getLists();
        setTastings(t);
        setCategories(c);
        setUserLists(l);
    }, []);

    const saveTasting = useCallback(async (t: Tasting) => {
        vibrate();
        await storageService.saveTasting(t);
        await refreshData();
        setView('DASHBOARD');
        showToast("Cata guardada", 'success');
    }, [refreshData, showToast, setView]);

    const deleteTasting = useCallback(async (id: string) => {
        await storageService.deleteTasting(id);
        await refreshData();
        showToast("Cata eliminada", 'success');
        if (selectedTasting?.id === id) {
            setSelectedTasting(null);
            setView('DASHBOARD');
        }
    }, [refreshData, showToast, selectedTasting, setView]);

    const duplicateTasting = useCallback(async (t: Tasting) => {
        vibrate();
        const newT = { ...t, id: Date.now().toString(), name: `${t.name} (Copia)`, createdAt: Date.now(), updatedAt: Date.now() };
        await storageService.saveTasting(newT);
        await refreshData();
        showToast("Cata duplicada", 'success');
    }, [refreshData, showToast]);

    const duplicateTastingAsVintage = useCallback(async (t: Tasting) => {
        vibrate();
        const newT: Tasting = { 
            ...t, 
            id: Date.now().toString(), 
            name: t.name, 
            vintage: '', 
            price: '', 
            score: 0, 
            images: [], 
            thumbnail: undefined,
            notes: '', 
            visual: '', aroma: '', taste: '',
            stock: 1, 
            openDate: undefined,
            createdAt: Date.now(), 
            updatedAt: Date.now() 
        };
        await storageService.saveTasting(newT);
        await refreshData();
        setSelectedTasting(newT);
        setView('NEW');
        showToast("Nueva añada creada. ¡Edítala!", 'success');
        return newT.id;
    }, [refreshData, showToast, setSelectedTasting, setView]);

    const toggleFavorite = useCallback(async (t: Tasting) => {
        vibrate();
        const updated = { ...t, isFavorite: !t.isFavorite };
        await storageService.saveTasting(updated);
        await refreshData();
        if (selectedTasting?.id === t.id) setSelectedTasting(updated);
        showToast(updated.isFavorite ? "Añadido a Favoritos" : "Eliminado de Favoritos", 'info');
    }, [refreshData, showToast, selectedTasting]);

    const updateStock = useCallback(async (t: Tasting, delta: number) => {
        vibrate();
        const current = t.stock || 0;
        const newStock = Math.max(0, current + delta);
        const updated = { ...t, stock: newStock };
        await storageService.saveTasting(updated);
        await refreshData();
        if (selectedTasting?.id === t.id) setSelectedTasting(updated);
    }, [refreshData, selectedTasting]);

    const updateCategories = useCallback(async (newCats: Category[]) => {
        await storageService.saveCategories(newCats);
        await refreshData();
    }, [refreshData]);

    const updateTags = useCallback(async (oldTag: string, newTag: string | null) => {
        vibrate();
        const updatedTastings = tastings.map(t => {
            if (t.tags.includes(oldTag)) {
                const newTags = t.tags.filter(tag => tag !== oldTag);
                if (newTag && !newTags.includes(newTag)) newTags.push(newTag);
                return { ...t, tags: newTags };
            }
            return t;
        });
        
        for (const t of updatedTastings) {
             const original = tastings.find(ot => ot.id === t.id);
             if (original && JSON.stringify(original.tags) !== JSON.stringify(t.tags)) {
                 await storageService.saveTasting(t);
             }
        }
        await refreshData();
        showToast(newTag ? "Renombrada" : "Eliminada", 'success');
    }, [tastings, refreshData, showToast]);

    const renameProducer = useCallback(async (oldName: string, newName: string) => {
        vibrate();
        const toUpdate: Tasting[] = [];
        tastings.forEach(t => {
            if (t.producer === oldName) {
                toUpdate.push({ ...t, producer: newName, updatedAt: Date.now() });
            }
        });
        if (toUpdate.length > 0) {
            await storageService.saveTastingsBulk(toUpdate);
            await refreshData();
            showToast(`Actualizadas ${toUpdate.length} catas`, 'success');
        } else {
            showToast("No se encontraron coincidencias", 'info');
        }
    }, [tastings, refreshData, showToast]);

    const optimizeTagsBulk = useCallback(async () => {
        try {
            showToast("Analizando etiquetas con IA...", "info");
            const allTags = Array.from(new Set(tastings.flatMap(t => t.tags))) as string[];
            if (allTags.length === 0) { showToast("No hay etiquetas", "info"); return; }
            
            const corrections = await optimizeTagList(allTags);
            if (!corrections || corrections.length === 0) { showToast("La IA dice que todo está perfecto.", "success"); return; }
            
            const map: Record<string, string> = {};
            // FIX TS7006: Add explicit type to correction item
            corrections.forEach((c: TagCorrection) => map[c.original] = c.corrected);
            
            let changes = 0;
            const tastingsToUpdate: Tasting[] = [];
            
            tastings.forEach((t: Tasting) => {
                let modified = false;
                const newTags = t.tags.map(tag => {
                    if (map[tag] && map[tag] !== tag) {
                        modified = true;
                        return map[tag];
                    }
                    return tag;
                });
                const uniqueNewTags = Array.from(new Set(newTags));
                if (modified || uniqueNewTags.length !== t.tags.length) {
                    changes++;
                    tastingsToUpdate.push({ ...t, tags: uniqueNewTags });
                }
            });

            if (changes > 0) {
                showToast(`Unificando etiquetas en ${changes} catas...`, "info");
                await storageService.saveTastingsBulk(tastingsToUpdate);
                await refreshData();
                showToast(`¡Optimización completada!`, "success");
            } else {
                showToast("La IA no sugirió cambios.", "info");
            }
        } catch (e) {
            console.error(e);
            showToast("Error al conectar con la IA.", "error");
        }
    }, [tastings, refreshData, showToast]);

    const mergeTastings = useCallback(async (sourceId: string, targetId: string) => {
        const source = tastings.find(t => t.id === sourceId);
        const target = tastings.find(t => t.id === targetId);
        if (!source || !target) return;
        
        const newStock = (target.stock || 0) + (source.stock || 0);
        const mergedImages = Array.from(new Set([...target.images, ...source.images]));
        const mergedTags = Array.from(new Set([...target.tags, ...source.tags]));
        const mergedTasting = { ...target, stock: newStock, images: mergedImages, tags: mergedTags, updatedAt: Date.now() };
        
        await storageService.saveTasting(mergedTasting);
        await storageService.deleteTasting(sourceId);
        await refreshData();
        showToast("Fusión completada", 'success');
    }, [tastings, refreshData, showToast]);

    const createList = useCallback(async (name: string) => {
        const newList: UserList = { id: Date.now().toString(), name, itemIds: [], createdAt: Date.now() };
        await storageService.saveLists([...userLists, newList]);
        await refreshData();
        showToast("Lista creada", 'success');
    }, [userLists, refreshData, showToast]);

    const deleteList = useCallback(async (id: string) => {
        await storageService.saveLists(userLists.filter(l => l.id !== id));
        await refreshData();
        showToast("Lista eliminada", 'success');
    }, [userLists, refreshData, showToast]);

    const addItemsToList = useCallback(async (listId: string, itemIds: string[]) => {
        const targetList = userLists.find(l => l.id === listId);
        if(!targetList) return;
        const uniqueIds = Array.from(new Set([...targetList.itemIds, ...itemIds]));
        const updatedList = { ...targetList, itemIds: uniqueIds };
        await storageService.saveLists(userLists.map(l => l.id === listId ? updatedList : l));
        await refreshData();
        showToast("Añadido a lista", 'success');
    }, [userLists, refreshData, showToast]);
    
    const deleteTastingsBulk = useCallback(async (ids: string[]) => {
        for(const id of ids) await storageService.deleteTasting(id);
        await refreshData();
        showToast(`${ids.length} elementos eliminados`, 'success');
    }, [refreshData, showToast]);

    const exportData = useCallback(async (includeImages = true) => storageService.exportData(includeImages), []);
    const importData = useCallback(async (json: string) => {
        const s = await storageService.importData(json);
        if(s) await refreshData();
        return s;
    }, [refreshData]);
    
    const exportCSV = useCallback(async () => {
        const csv = await storageService.exportToCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `katalist_export.csv`;
        a.click();
        showToast("CSV generado", 'success');
    }, [showToast]);

    const toggleCompare = useCallback((id: string) => {
        setCompareList(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            if (prev.length >= 2) {
                showToast("Máximo 2 para comparar", 'error');
                return prev;
            }
            return [...prev, id];
        });
    }, [showToast]);

    const clearCompare = useCallback(() => setCompareList([]), []);

    return {
        tastings, categories, userLists, selectedTasting, compareList,
        setSelectedTasting, refreshData, saveTasting, deleteTasting, duplicateTasting, duplicateTastingAsVintage, toggleFavorite,
        updateStock, updateCategories, updateTags, renameProducer, optimizeTagsBulk, mergeTastings,
        createList, deleteList, addItemsToList, deleteTastingsBulk,
        exportData, importData, exportCSV, toggleCompare, clearCompare
    };
};
