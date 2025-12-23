
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useKataContext } from '../context/KataContext';
import { Tasting, FlavorProfile } from '../types';
import { Icon, AccordionSection, ConfirmModal } from './Shared';
import { compressImage, getProfileLabels } from '../utils/helpers';
import { fetchBeverageInfo, generateBeverageImage, editBeverageImage, analyzeLabelFromImage, analyzeTastingNotes } from '../services/geminiService';
import { storageService } from '../services/storageService';
import { MediaSection, MainSection, TechSection, SensorySection } from './FormSections';

const DRAFT_KEY = 'katalist_draft_v1';

export const TastingForm = React.memo(({ initialData, onCancel }: { initialData?: Tasting, onCancel?: () => void }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { saveTasting, showToast, tastings, selectedTasting } = useKataContext();
    const isNewMode = location.pathname === '/new';

    const [tasting, setTasting] = useState<Tasting>(() => {
        if (initialData) return initialData;
        if (!isNewMode && selectedTasting && selectedTasting.id === id) return selectedTasting;
        if (isNewMode) {
            const savedDraft = localStorage.getItem(DRAFT_KEY);
            if (savedDraft) {
                try { return JSON.parse(savedDraft); } catch(e) {}
            }
        }
        return { id: Date.now().toString(), name: '', producer: '', variety: '', category: '', subcategory: '', country: '', region: '', location: '', abv: '', vintage: '', price: '', score: 5, isFavorite: false, isWishlist: false, visual: '', aroma: '', taste: '', pairing: '', notes: '', images: [], tags: [], stock: 0, createdAt: Date.now(), updatedAt: Date.now(), profile: { p1: 3, p2: 3, p3: 3, p4: 3, p5: 3 } };
    });

    const [activeSection, setActiveSection] = useState<'MEDIA'|'MAIN'|'TECH'|'NOTES'>('MAIN');
    const [loadingState, setLoadingState] = useState<'idle' | 'uploading' | 'analyzing' | 'generating'>('idle');
    const [isDirty, setIsDirty] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        if (id) return; 
        const timeout = setTimeout(() => {
            if (tasting.name || tasting.notes) localStorage.setItem(DRAFT_KEY, JSON.stringify(tasting));
        }, 2000); 
        return () => clearTimeout(timeout);
    }, [tasting, id]);

    useEffect(() => {
        if (selectedTasting && !isNewMode && selectedTasting.id === id) {
             const loadImages = async () => {
                const loaded = await Promise.all(selectedTasting.images.map(img => storageService.getImage(img)));
                setTasting(prev => ({ ...prev, images: loaded.filter(Boolean) as string[] }));
            };
            loadImages();
        }
    }, [selectedTasting, isNewMode, id]);

    const toggleSection = (s: typeof activeSection) => setActiveSection(activeSection === s ? 'MAIN' : s);
    
    const handleChange = (field: keyof Tasting, value: any) => { 
        setIsDirty(true);
        setTasting(prev => {
            const newData = { ...prev, [field]: value };
            if (field === 'category') newData.subcategory = '';
            return newData;
        });
    };

    const handleProfileChange = (p: keyof FlavorProfile, v: number) => { 
        setIsDirty(true);
        setTasting(prev => ({ ...prev, profile: { ...prev.profile!, [p]: v } })); 
    };

    const possibleDuplicate = useMemo(() => {
        if (!tasting.name || tasting.name.length < 3) return null;
        return tastings.find(t => t.name.toLowerCase() === tasting.name.toLowerCase() && t.id !== tasting.id);
    }, [tasting.name, tastings, tasting.id]);

    const handleSave = async () => { 
        if (!tasting.name) return showToast("El nombre es obligatorio", "error"); 
        if (!tasting.category) return showToast("Selecciona una categoría", "error"); 
        setLoadingState('uploading'); 
        await saveTasting({ ...tasting, updatedAt: Date.now() }); 
        localStorage.removeItem(DRAFT_KEY);
        setIsDirty(false);
        setLoadingState('idle'); 
    };

    const handleCancelWrapped = () => isDirty ? setShowExitConfirm(true) : proceedCancel();

    const proceedCancel = () => {
        setIsDirty(false);
        setShowExitConfirm(false);
        if (onCancel) return onCancel();
        id ? navigate(`/tasting/${id}`) : navigate('/', { replace: true });
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                const compressed = await compressImage(e.target.files[0]);
                setIsDirty(true);
                setTasting(prev => ({ ...prev, images: [compressed, ...prev.images] }));
            } catch (err) { showToast("Error procesando imagen", "error"); }
        }
    };

    const handleGenImage = async (prompt: string) => { 
        if (loadingState !== 'idle') return;
        setLoadingState('generating'); 
        try { 
            const img = await generateBeverageImage({ prompt: prompt || tasting.name, aspectRatio: '1:1' }); 
            setIsDirty(true);
            setTasting(prev => ({ ...prev, images: [img, ...prev.images] })); 
            showToast("Imagen generada", "success"); 
        } catch (e: any) { 
            let msg = "Error al generar imagen.";
            if (e.message?.includes('Límite')) msg = e.message;
            showToast(msg, "error"); 
        } 
        setLoadingState('idle'); 
    };

    const handleEditImage = async (index: number, instruction: string) => { 
        if (!instruction || loadingState !== 'idle') return; 
        setLoadingState('generating'); 
        try { 
            const newImg = await editBeverageImage(tasting.images[index], instruction); 
            setIsDirty(true);
            setTasting(prev => { 
                const newImages = [...prev.images]; 
                newImages[index] = newImg; 
                return { ...prev, images: newImages }; 
            }); 
            showToast("Imagen editada", "success"); 
        } catch(e: any) { showToast("No se pudo editar.", "error"); } 
        setLoadingState('idle'); 
    };
    
    const handleAutoFill = async () => { 
        if (!tasting.name) return showToast("Escribe un nombre primero", "error"); 
        if (loadingState !== 'idle') return;
        setLoadingState('analyzing'); 
        showToast("Investigando (puede tardar)...", "info"); 
        try { 
            const info = await fetchBeverageInfo(tasting.name); 
            setIsDirty(true);
            setTasting(prev => ({ 
                ...prev, 
                ...info,
                id: prev.id,
                images: prev.images,
                score: prev.score,
                isFavorite: prev.isFavorite,
                stock: prev.stock,
                createdAt: prev.createdAt
            })); 
            showToast("Datos completados", "success"); 
        } catch (e: any) { 
            let userFriendlyMsg = "Sin resultados.";
            if (e.message?.includes('Límite') || e.message?.includes('cuota') || e.message?.includes('429')) {
                userFriendlyMsg = "Límite de cuota IA alcanzado. Espera un minuto.";
            }
            showToast(userFriendlyMsg, "error"); 
        } 
        setLoadingState('idle'); 
    };
    
    const handleScanLabel = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = async (e: any) => {
            if (e.target.files?.[0]) {
                setLoadingState('analyzing');
                try {
                    const compressed = await compressImage(e.target.files[0]);
                    const data = await analyzeLabelFromImage(compressed);
                    setIsDirty(true);
                    setTasting(prev => ({ ...prev, ...data, id: prev.id, images: [compressed, ...prev.images] }));
                    showToast("Datos extraídos", "success");
                } catch(err: any) { showToast("No se pudo leer la etiqueta.", "error"); }
                setLoadingState('idle');
            }
        };
        input.click();
    };
    
    const handleDictation = (field: keyof Tasting, text: string) => { 
        setIsDirty(true);
        setTasting(prev => { const cur = (prev[field] as string) || ''; const sep = cur.length > 0 && !cur.endsWith(' ') ? ' ' : ''; return { ...prev, [field]: cur + sep + text }; }); 
    };
    
    const handleAnalyzeNotes = async () => { 
        const fullText = `${tasting.visual} ${tasting.aroma} ${tasting.taste} ${tasting.notes}`; 
        if (fullText.trim().length < 10 || loadingState !== 'idle') return showToast("Escribe más notas primero.", "error"); 
        setLoadingState('analyzing'); 
        try { 
            const labels = getProfileLabels(tasting.category); 
            const result = await analyzeTastingNotes(fullText, tasting.category, labels); 
            setIsDirty(true);
            setTasting(prev => ({ ...prev, tags: Array.from(new Set([...prev.tags, ...(result.tags || [])])), profile: result.profile || prev.profile })); 
            showToast("Notas etiquetadas", "success"); 
        } catch (e: any) { showToast("Error analizando notas.", "error"); } 
        setLoadingState('idle'); 
    };

    return (
        <div className="flex flex-col h-full w-full bg-dark-900">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-dark-900/95 backdrop-blur z-10 shrink-0">
                <button onClick={handleCancelWrapped} className="text-slate-400 font-medium active:scale-95 transition">Cancelar</button>
                <button onClick={handleScanLabel} className="bg-slate-800 text-primary-500 px-3 py-1 rounded-full text-xs font-bold border border-slate-700 flex items-center gap-1 active:scale-95 transition"><Icon name="document_scanner" className="text-sm" /> Escanear</button>
                <button onClick={handleSave} disabled={loadingState !== 'idle'} className="text-primary-500 font-bold disabled:opacity-50 min-w-[60px] text-right">
                    {loadingState === 'uploading' ? '...' : 'Guardar'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 space-y-4 w-full">
                <AccordionSection title="Multimedia" icon="image" isOpen={activeSection === 'MEDIA'} onToggle={() => toggleSection('MEDIA')}>
                    <MediaSection tasting={tasting} setTasting={setTasting} handleFile={handleFile} handleGenImage={handleGenImage} handleEditImage={handleEditImage} isLoading={loadingState !== 'idle'} />
                </AccordionSection>
                <AccordionSection title="Datos Principales" icon="info" isOpen={activeSection === 'MAIN'} onToggle={() => toggleSection('MAIN')}>
                    <MainSection tasting={tasting} handleChange={handleChange} handleAutoFill={handleAutoFill} isLoading={loadingState !== 'idle'} possibleDuplicate={possibleDuplicate} />
                </AccordionSection>
                <AccordionSection title="Detalles Técnicos" icon="science" isOpen={activeSection === 'TECH'} onToggle={() => toggleSection('TECH')}>
                    <TechSection tasting={tasting} handleChange={handleChange} />
                </AccordionSection>
                <AccordionSection title="Notas & Perfil" icon="edit_note" isOpen={activeSection === 'NOTES'} onToggle={() => toggleSection('NOTES')}>
                    <SensorySection tasting={tasting} handleChange={handleChange} handleProfileChange={handleProfileChange} handleAnalyzeNotes={handleAnalyzeNotes} handleDictation={handleDictation} isLoading={loadingState !== 'idle'} />
                </AccordionSection>
            </div>

            <ConfirmModal isOpen={showExitConfirm} title="Cambios sin guardar" message="¿Estás seguro de que quieres salir?" onConfirm={proceedCancel} onCancel={() => setShowExitConfirm(false)} />
        </div>
    );
});
