
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useKataContext } from '../context/KataContext';
import { Icon, SafeImage, RadarChart, Skeleton, SkeletonDetail, LinkifiedText } from './Shared';
import { getCategoryColor, getProfileLabels, getDrinkingStatus, generateSocialCard, getCountryFlag, SocialTheme, base64ToBlobUrl } from '../utils/helpers';
import { getTagColor } from '../utils/flavorTags';
import { storageService } from '../services/storageService';
import { generateTastingPDF } from '../services/pdfService';
import { Tasting } from '../types';

export const TastingDetail = React.memo(() => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { tastings, selectedTasting, setSelectedTasting, setView, toggleFavorite, confirmDelete, categories, duplicateTasting, duplicateTastingAsVintage, showToast, updateStock, currency, saveTasting, formatScore } = useKataContext();
    
    // Local state for the current tasting
    const [currentTasting, setCurrentTasting] = useState<Tasting | null>(selectedTasting);
    
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [fullImages, setFullImages] = useState<string[]>([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const [showThemeSelector, setShowThemeSelector] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

    // Zoom State
    const [zoomLevel, setZoomLevel] = useState(1);
    const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });

    // Sync from context or URL params
    useEffect(() => {
        // Priority 1: Context already has the selected item matching the URL
        if (selectedTasting && selectedTasting.id === id) {
            setCurrentTasting(selectedTasting);
        } 
        // Priority 2: URL has ID, find it in tastings list
        else if (id && tastings.length > 0) {
            const found = tastings.find(t => t.id === id);
            if (found) {
                setCurrentTasting(found);
                setSelectedTasting(found);
            }
        }
    }, [id, tastings, selectedTasting, setSelectedTasting]);

    if (!currentTasting) return <SkeletonDetail />;

    useEffect(() => {
        let isMounted = true;
        let blobUrls: string[] = [];

        const loadImages = async () => {
            if (!currentTasting.images || currentTasting.images.length === 0) {
                setFullImages([]);
                return;
            }
            setLoadingImages(true);
            const loaded = await Promise.all(currentTasting.images.map(img => storageService.getImage(img)));
            const validBase64s = loaded.filter(Boolean) as string[];
            
            // Memory Optimization: Convert heavy Base64 strings to Blob URLs
            blobUrls = validBase64s.map(b64 => base64ToBlobUrl(b64));
            
            if (isMounted) {
                setFullImages(blobUrls);
                setLoadingImages(false);
            }
        };
        loadImages();
        
        // Cleanup function to revoke Blob URLs and free memory
        return () => { 
            isMounted = false;
            blobUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [currentTasting]);

    const categoryColor = getCategoryColor(currentTasting.category, categories);
    const profileLabels = getProfileLabels(currentTasting.category);
    const drinkingStatus = getDrinkingStatus(currentTasting.drinkFrom, currentTasting.drinkTo);

    // --- Data Completeness Check ---
    const isDataComplete = !!(
        currentTasting.producer && 
        currentTasting.vintage && 
        currentTasting.abv && 
        currentTasting.price && 
        currentTasting.notes && 
        currentTasting.tags.length > 0
    );

    // --- Open Bottle Logic ---
    const isOpen = !!currentTasting.openDate;
    const daysOpen = isOpen ? Math.floor((Date.now() - currentTasting.openDate!) / (1000 * 60 * 60 * 24)) : 0;
    const hoursOpen = isOpen ? Math.floor((Date.now() - currentTasting.openDate!) / (1000 * 60 * 60)) : 0;

    const handleOpenBottle = async () => {
        if ((currentTasting.stock || 0) < 1) return showToast("No hay stock para abrir.", "error");
        // Decrement stock and set open date
        const updated = { 
            ...currentTasting, 
            stock: (currentTasting.stock || 0) - 1,
            openDate: Date.now()
        };
        await saveTasting(updated);
        // Ensure we stay on the view with updated data
        setSelectedTasting(updated);
        setCurrentTasting(updated);
        showToast("¡Botella abierta! Salud 🥂", "success");
    };

    const handleFinishBottle = async () => {
        // Just clear the open date. Stock was already decremented when opened.
        const updated = { ...currentTasting, openDate: undefined };
        await saveTasting(updated);
        setSelectedTasting(updated);
        setCurrentTasting(updated);
        showToast("Botella terminada.", "info");
    };

    // Freshness Logic (Visual Indicator)
    const getFreshness = () => {
        const cat = currentTasting.category.toLowerCase();
        let maxDays = 30; // Spirits default
        if (cat.includes('vino') || cat.includes('wine')) maxDays = 5;
        if (currentTasting.subcategory.toLowerCase().includes('espumoso')) maxDays = 2;
        if (cat.includes('cerveza')) maxDays = 1;
        
        const percent = Math.max(0, 100 - (daysOpen / maxDays * 100));
        let color = 'bg-green-500';
        if (percent < 50) color = 'bg-yellow-500';
        if (percent < 20) color = 'bg-red-500';
        
        return { percent, color, maxDays };
    };
    const freshness = getFreshness();


    const handleShareText = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: currentTasting.name,
                    text: `Probé ${currentTasting.name} (${currentTasting.score}/10). ${currentTasting.notes}`
                });
            } catch (e) {}
        }
        setShowShareMenu(false);
    };

    const handleShareImage = async (theme: SocialTheme) => {
        showToast("Generando Story...", "info");
        try {
            // Re-fetch base64 for export functions that require data URI
            const imgId = currentTasting.images[0];
            const base64Img = imgId ? await storageService.getImage(imgId) : undefined;
            
            const blob = await generateSocialCard(currentTasting, categoryColor, base64Img, theme);
            if (blob) {
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'story.jpg', { type: 'image/jpeg' })] })) {
                     await navigator.share({
                         files: [new File([blob], 'story.jpg', { type: 'image/jpeg' })],
                         title: currentTasting.name,
                         text: `Mi reseña de ${currentTasting.name} en KataList`
                     });
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${currentTasting.name}_story.jpg`;
                    a.click();
                    showToast("Imagen descargada", "success");
                }
            } else {
                showToast("Error generando imagen", "error");
            }
        } catch(e) {
            console.error(e);
            showToast("Error al compartir imagen", "error");
        }
        setShowThemeSelector(false);
        setShowShareMenu(false);
    };
    
    const handleExportPDF = async () => {
        showToast("Generando PDF...", "info");
        try {
            // Re-fetch base64 for PDF generation
            const imgId = currentTasting.images[0];
            const base64Img = imgId ? await storageService.getImage(imgId) : undefined;

            await generateTastingPDF(currentTasting, base64Img); 
            showToast("PDF Descargado", "success");
        } catch (e) {
            console.error(e);
            showToast("Error creando PDF", "error");
        }
        setShowShareMenu(false);
    };

    const handleCopyNotes = () => {
        const text = `${currentTasting.name}\n${currentTasting.visual}\n${currentTasting.aroma}\n${currentTasting.taste}\n${currentTasting.notes}`;
        navigator.clipboard.writeText(text);
        showToast("Notas copiadas", "success");
    };

    // Gallery Logic
    const nextImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (fullscreenIndex !== null) {
            setFullscreenIndex((fullscreenIndex + 1) % fullImages.length);
            resetZoom();
        }
    };
    const prevImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (fullscreenIndex !== null) {
            setFullscreenIndex((fullscreenIndex - 1 + fullImages.length) % fullImages.length);
            resetZoom();
        }
    };
    
    // Zoom/Pan Handlers
    const resetZoom = () => {
        setZoomLevel(1);
        setPanPosition({ x: 0, y: 0 });
    };

    const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (zoomLevel > 1) {
            resetZoom();
        } else {
            setZoomLevel(2.5);
        }
    };

    const handlePanStart = (clientX: number, clientY: number) => {
        if (zoomLevel > 1) {
            isDraggingRef.current = true;
            lastMousePosRef.current = { x: clientX, y: clientY };
        }
    };

    const handlePanMove = (clientX: number, clientY: number) => {
        if (isDraggingRef.current && zoomLevel > 1) {
            const dx = clientX - lastMousePosRef.current.x;
            const dy = clientY - lastMousePosRef.current.y;
            setPanPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastMousePosRef.current = { x: clientX, y: clientY };
        }
    };

    const handlePanEnd = () => {
        isDraggingRef.current = false;
    };

    // Swipe Logic (Only when not zoomed)
    const [touchStart, setTouchStart] = useState(0);
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            setTouchStart(e.targetTouches[0].clientX);
            handlePanStart(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
        }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            handlePanMove(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
        }
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        handlePanEnd();
        if (zoomLevel === 1 && touchStart) {
            const touchEnd = e.changedTouches[0].clientX;
            const distance = touchStart - touchEnd;
            if (distance > 50) nextImage();
            if (distance < -50) prevImage();
        }
        setTouchStart(0);
    };

    const toggleWishlist = () => {
        const updated = { ...currentTasting, isWishlist: !currentTasting.isWishlist };
        saveTasting(updated);
        setCurrentTasting(updated);
    };

    const handleEdit = () => {
        // Edit current tasting
        setView('NEW'); 
        navigate(`/edit/${currentTasting.id}`);
    };

    const handleNewVintage = async () => {
        const newId = await duplicateTastingAsVintage(currentTasting);
        navigate(`/edit/${newId}`);
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto scrollbar-hide bg-dark-950 pb-24 animate-fade-in relative">
            
            {/* Fullscreen Gallery Overlay */}
            {fullscreenIndex !== null && (
                <div 
                    className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in touch-none"
                    onMouseDown={(e) => handlePanStart(e.clientX, e.clientY)}
                    onMouseMove={(e) => handlePanMove(e.clientX, e.clientY)}
                    onMouseUp={handlePanEnd}
                    onMouseLeave={handlePanEnd}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <button onClick={() => setFullscreenIndex(null)} className="absolute top-4 right-4 p-3 bg-white/10 rounded-full text-white backdrop-blur z-20"><Icon name="close" /></button>
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden" onDoubleClick={handleDoubleTap}>
                        <div 
                            style={{ 
                                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`, 
                                transition: isDraggingRef.current ? 'none' : 'transform 0.3s ease-out' 
                            }}
                            className="w-full h-full flex items-center justify-center"
                        >
                            <SafeImage src={fullImages[fullscreenIndex]} className="max-w-full max-h-screen object-contain select-none pointer-events-none" alt="Fullscreen" />
                        </div>
                        
                        {/* Navigation Arrows (Only visible when not zoomed) */}
                        {fullImages.length > 1 && zoomLevel === 1 && (
                            <>
                                <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 p-4 text-white bg-black/20 hover:bg-black/50 rounded-full backdrop-blur transition"><Icon name="chevron_left" className="text-3xl" /></button>
                                <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 p-4 text-white bg-black/20 hover:bg-black/50 rounded-full backdrop-blur transition"><Icon name="chevron_right" className="text-3xl" /></button>
                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-1 bg-black/50 rounded-full text-white text-xs backdrop-blur font-bold tracking-widest">
                                    {fullscreenIndex + 1} / {fullImages.length}
                                </div>
                            </>
                        )}
                        {/* Zoom Hint */}
                        {zoomLevel === 1 && (
                            <div className="absolute top-4 left-4 bg-black/20 text-white/50 text-[10px] px-2 py-1 rounded backdrop-blur">Doble tap para zoom</div>
                        )}
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {showQR && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowQR(false)}>
                    <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
                        <h3 className="font-serif font-bold text-xl text-black">Escanea esta Botella</h3>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentTasting.name + ' - ' + currentTasting.notes)}`} alt="QR" className="w-48 h-48" />
                        <p className="text-xs text-gray-500 text-center max-w-[200px]">{currentTasting.name}</p>
                        <button onClick={() => setShowQR(false)} className="text-blue-600 font-bold text-sm">Cerrar</button>
                    </div>
                </div>
            )}

            <div className="h-64 relative cursor-pointer flex-shrink-0" onClick={() => fullImages.length > 0 && setFullscreenIndex(0)}>
                {fullImages[0] ? ( <SafeImage src={fullImages[0]} className="w-full h-full object-cover" alt={currentTasting.name} /> ) : ( <div className="w-full h-full bg-slate-800 flex items-center justify-center">{loadingImages ? <Skeleton className="w-full h-full" /> : <Icon name="image_not_supported" className="text-4xl text-slate-600" />}</div> )}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/50 to-transparent"></div>
                
                {/* Header Actions */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setView('SEARCH'); navigate('/search'); }} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60 transition"><Icon name="arrow_back" /></button>
                    <div className="flex gap-2">
                        <button onClick={() => setShowQR(true)} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60 transition"><Icon name="qr_code_2" /></button>
                        <div className="relative">
                            <button onClick={() => setShowShareMenu(!showShareMenu)} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60 transition"><Icon name="share" /></button>
                            {showShareMenu && (
                                <div className="absolute top-12 right-0 bg-dark-800 border border-slate-700 rounded-xl p-2 w-48 shadow-2xl animate-fade-in z-50">
                                    {!showThemeSelector ? (
                                        <>
                                            <button onClick={handleShareText} className="w-full text-left p-2 hover:bg-slate-700 rounded-lg text-sm text-white flex items-center gap-2"><Icon name="notes" className="text-xs" /> Texto</button>
                                            <button onClick={() => setShowThemeSelector(true)} className="w-full text-left p-2 hover:bg-slate-700 rounded-lg text-sm text-white flex items-center gap-2"><Icon name="image" className="text-xs" /> Story (Imagen)</button>
                                            <button onClick={handleExportPDF} className="w-full text-left p-2 hover:bg-slate-700 rounded-lg text-sm text-white flex items-center gap-2"><Icon name="description" className="text-xs" /> Ficha Técnica (PDF)</button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="px-2 py-1 text-xs text-slate-400 font-bold uppercase border-b border-slate-700 mb-1">Elige Estilo</div>
                                            <button onClick={() => handleShareImage('NEON')} className="w-full text-left p-2 hover:bg-slate-700 rounded-lg text-sm text-purple-400 font-bold">🟣 Neón</button>
                                            <button onClick={() => handleShareImage('MINIMAL')} className="w-full text-left p-2 hover:bg-slate-700 rounded-lg text-sm text-white font-bold">⚪ Minimal</button>
                                            <button onClick={() => handleShareImage('ELEGANT')} className="w-full text-left p-2 hover:bg-slate-700 rounded-lg text-sm text-yellow-500 font-bold">🟡 Elegante</button>
                                            <button onClick={() => setShowThemeSelector(false)} className="w-full text-left p-2 mt-1 border-t border-slate-700 text-xs text-slate-400 text-center">Volver</button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <button onClick={() => toggleFavorite(currentTasting)} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60 transition"><Icon name={currentTasting.isFavorite ? "star" : "star_border"} className={currentTasting.isFavorite ? "text-yellow-400" : ""} /></button>
                        <button onClick={handleEdit} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60 transition"><Icon name="edit" /></button>
                        <button onClick={() => { confirmDelete(currentTasting.id); navigate('/search'); }} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur text-red-400 flex items-center justify-center hover:bg-black/60 transition"><Icon name="delete" /></button>
                    </div>
                </div>

                {/* Bottom Info & Badges - Right Aligned Column */}
                <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex items-end justify-between">
                    {/* Left side: Title and Info */}
                    <div className="flex-1 pr-2">
                        <h1 className="text-3xl font-serif font-bold text-white leading-tight drop-shadow-lg line-clamp-2">{currentTasting.name}</h1>
                        <p className="text-slate-300 text-sm mt-1 flex items-center gap-2">{currentTasting.producer && <span className="font-bold text-blue-200">{currentTasting.producer}</span>}{currentTasting.country} {getCountryFlag(currentTasting.country)}</p>
                    </div>

                    {/* Right side: Badges Stacked */}
                    <div className="flex flex-col items-end gap-2 mb-1 flex-shrink-0">
                        {isDataComplete && (
                             <span className="px-2 py-1 rounded bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] uppercase font-bold tracking-wider shadow-lg flex items-center gap-1 border border-white/20">
                                🏅 Ficha Maestra
                            </span>
                        )}

                        <span className="px-2 py-1 rounded bg-black/60 backdrop-blur text-white text-[10px] uppercase font-bold tracking-wider border-l-2 shadow-sm" style={{ borderLeftColor: categoryColor }}>{currentTasting.category}</span>
                        
                        {currentTasting.isWishlist && (
                            <span className="px-2 py-1 rounded bg-purple-600/90 backdrop-blur text-white text-[10px] uppercase font-bold tracking-wider shadow-lg">🎁 Por Comprar</span>
                        )}
                        
                        {currentTasting.score >= 8.5 && (
                            <span className="px-2 py-1 rounded bg-gradient-to-r from-yellow-600/90 to-amber-600/90 backdrop-blur text-white text-[10px] uppercase font-bold tracking-wider shadow-lg flex items-center gap-1">
                                💎 Joya Oculta
                            </span>
                        )}
                        
                        {isOpen ? (
                            <span className="px-2 py-1 rounded bg-orange-900/90 backdrop-blur text-orange-200 text-[10px] uppercase font-bold tracking-wider shadow-lg flex items-center gap-1 border border-orange-500/50">
                                <Icon name="timelapse" className="text-[10px]" /> Abierta
                            </span>
                        ) : (currentTasting.stock || 0) > 0 ? (
                            <span className="px-2 py-1 rounded bg-green-900/80 backdrop-blur text-green-300 text-[10px] uppercase font-bold tracking-wider border border-green-500/30">En Bodega ({currentTasting.stock})</span>
                        ) : (
                            <span className="px-2 py-1 rounded bg-slate-800/80 backdrop-blur text-slate-400 text-[10px] uppercase font-bold tracking-wider border border-slate-600/30">Agotado</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-6">
                
                {/* --- OPEN BOTTLE CONTROL SECTION --- */}
                {!currentTasting.isWishlist && ((currentTasting.stock || 0) > 0 || isOpen) && (
                    <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg transition-all ${isOpen ? 'bg-gradient-to-r from-orange-900/30 to-slate-900 border-orange-500/30' : 'bg-slate-800 border-slate-700'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isOpen ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-400'}`}>
                                <Icon name={isOpen ? "timelapse" : "lock"} className="text-2xl" />
                            </div>
                            <div>
                                <span className={`text-xs font-bold uppercase tracking-wider block ${isOpen ? 'text-orange-300' : 'text-slate-400'}`}>
                                    {isOpen ? 'Botella en Consumo' : 'Estado'}
                                </span>
                                {isOpen ? (
                                    <span className="text-white font-serif font-bold">
                                        Abierta el {new Date(currentTasting.openDate!).toLocaleDateString()}
                                    </span>
                                ) : (
                                    <span className="text-white font-medium">Cerrada / Sellada</span>
                                )}
                            </div>
                        </div>
                        
                        {isOpen ? (
                            <button onClick={handleFinishBottle} className="p-3 bg-slate-700 hover:bg-red-600/80 text-white rounded-xl flex items-center justify-center transition active:scale-95 shadow-md" title="Terminar botella">
                                <Icon name="delete" />
                            </button>
                        ) : (
                            <button onClick={handleOpenBottle} className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary-900/20 transition active:scale-95">
                                <Icon name="check" /> Abrir
                            </button>
                        )}
                    </div>
                )}
                
                {/* Freshness Bar (Only if Open) */}
                {isOpen && (
                    <div className="bg-dark-900 p-3 rounded-xl border border-slate-800">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1 uppercase font-bold">
                            <span>Frescura Estimada</span>
                            <span>{freshness.maxDays - daysOpen > 0 ? `${freshness.maxDays - daysOpen} días restantes` : 'Consumir pronto'}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${freshness.color} transition-all duration-1000`} style={{ width: `${freshness.percent}%` }}></div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-4 gap-2">
                    {!currentTasting.isWishlist && (
                        <div className="bg-dark-800 p-2 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center"><span className="text-[10px] text-slate-500 uppercase">Puntos</span><span className={`text-xl font-bold ${currentTasting.score >= 8 ? 'text-green-400' : 'text-yellow-400'}`}>{formatScore(currentTasting.score)}</span></div>
                    )}
                    <div className="bg-dark-800 p-2 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center"><span className="text-[10px] text-slate-500 uppercase">ABV</span><span className="text-sm font-bold text-white">{currentTasting.abv ? currentTasting.abv + '%' : '-'}</span></div><div className="bg-dark-800 p-2 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center"><span className="text-[10px] text-slate-500 uppercase">Año</span><span className="text-sm font-bold text-white">{currentTasting.vintage || '-'}</span></div><div className="bg-dark-800 p-2 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center"><span className="text-[10px] text-slate-500 uppercase">Precio</span><span className="text-sm font-bold text-white">{currency} {currentTasting.price || '-'}</span></div>
                </div>
                
                {/* Split Section: Inventory (Left) & Wishlist Toggle (Right) */}
                <div className="grid grid-cols-2 gap-2">
                    {/* Stock */}
                    <div className="bg-dark-800 p-3 rounded-xl border border-slate-800 flex flex-col justify-center">
                        <span className="text-[10px] text-slate-500 uppercase mb-2 font-bold">Inventario (Cerradas)</span>
                        <div className="flex items-center justify-between">
                             <button onClick={() => updateStock(currentTasting, -1)} className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-red-900/50 text-white flex items-center justify-center transition active:scale-95"><Icon name="remove" /></button>
                             <span className="font-bold text-xl">{currentTasting.stock || 0}</span>
                             <button onClick={() => updateStock(currentTasting, 1)} className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition active:scale-95"><Icon name="add" /></button>
                        </div>
                    </div>

                    {/* Wishlist Indicator/Toggle */}
                    <button 
                        onClick={toggleWishlist}
                        className={`p-3 rounded-xl border flex flex-col justify-center items-center transition-all active:scale-95 ${currentTasting.isWishlist ? 'bg-purple-900/20 border-purple-500/50' : 'bg-dark-800 border-slate-800 hover:bg-slate-800'}`}
                    >
                        <span className="text-[10px] text-slate-500 uppercase mb-1 font-bold">Lista de Deseos</span>
                        <div className="flex items-center gap-2 mt-1">
                            <Icon name={currentTasting.isWishlist ? "card_giftcard" : "radio_button_unchecked"} className={currentTasting.isWishlist ? "text-purple-400 text-lg" : "text-slate-600 text-lg"} />
                            <span className={`font-bold text-sm ${currentTasting.isWishlist ? "text-purple-200" : "text-slate-500"}`}>
                                {currentTasting.isWishlist ? "Sí" : "No"}
                            </span>
                        </div>
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">{currentTasting.variety && <div className="bg-dark-800 p-2 rounded-lg border border-slate-800"><span className="text-slate-500 block">Variedad</span><span className="text-white font-medium">{currentTasting.variety}</span></div>}{currentTasting.region && <div className="bg-dark-800 p-2 rounded-lg border border-slate-800"><span className="text-slate-500 block">Región</span><span className="text-white font-medium">{currentTasting.region}</span></div>}{currentTasting.location && <div className="bg-dark-800 p-2 rounded-lg border border-slate-800"><span className="text-slate-500 block">Lugar Compra</span><span className="text-white font-medium">{currentTasting.location}</span></div>}{currentTasting.batch && <div className="bg-dark-800 p-2 rounded-lg border border-slate-800"><span className="text-slate-500 block">Lote</span><span className="text-white font-medium">{currentTasting.batch}</span></div>}</div>
                {(currentTasting.drinkFrom || currentTasting.drinkTo) && ( <div className={`p-3 rounded-xl flex items-center gap-3 border ${drinkingStatus === 'READY' ? 'bg-green-900/20 border-green-900/50' : drinkingStatus === 'HOLD' ? 'bg-blue-900/20 border-blue-900/50' : 'bg-red-900/20 border-red-900/50'}`}><Icon name={drinkingStatus === 'READY' ? 'wine_bar' : drinkingStatus === 'HOLD' ? 'hourglass_top' : 'history'} className={drinkingStatus === 'READY' ? 'text-green-400' : drinkingStatus === 'HOLD' ? 'text-blue-400' : 'text-red-400'} /><div><h4 className={`text-sm font-bold ${drinkingStatus === 'READY' ? 'text-green-200' : drinkingStatus === 'HOLD' ? 'text-blue-200' : 'text-red-200'}`}>{drinkingStatus === 'READY' ? 'Listo para beber' : drinkingStatus === 'HOLD' ? 'Guardar' : 'Pasado de fecha'}</h4><p className="text-xs text-slate-400">Ventana: {currentTasting.drinkFrom || '?'} - {currentTasting.drinkTo || '?'}</p></div></div> )}
                {currentTasting.profile && !currentTasting.isWishlist && ( <div className="bg-dark-800 p-4 rounded-2xl border border-slate-800 flex flex-col items-center"><h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">Perfil de Sabor</h3><RadarChart profile={currentTasting.profile} labels={profileLabels} /></div> )}
                <div className="space-y-4">
                    {currentTasting.visual && <div className="bg-dark-800 p-4 rounded-xl border border-slate-800"><h3 className="text-xs font-bold text-blue-400 uppercase mb-2 flex items-center gap-2"><Icon name="visibility" /> Visual</h3><p className="text-sm text-slate-300 leading-relaxed"><LinkifiedText text={currentTasting.visual} /></p></div>}
                    {currentTasting.aroma && <div className="bg-dark-800 p-4 rounded-xl border border-slate-800"><h3 className="text-xs font-bold text-purple-400 uppercase mb-2 flex items-center gap-2"><Icon name="face" /> Aroma</h3><p className="text-sm text-slate-300 leading-relaxed"><LinkifiedText text={currentTasting.aroma} /></p></div>}
                    {currentTasting.taste && <div className="bg-dark-800 p-4 rounded-xl border border-slate-800"><h3 className="text-xs font-bold text-pink-400 uppercase mb-2 flex items-center gap-2"><Icon name="local_bar" /> Gusto</h3><p className="text-sm text-slate-300 leading-relaxed"><LinkifiedText text={currentTasting.taste} /></p></div>}
                    {currentTasting.pairing && <div className="bg-dark-800 p-4 rounded-xl border border-slate-800"><h3 className="text-xs font-bold text-green-400 uppercase mb-2 flex items-center gap-2"><Icon name="restaurant" /> Maridaje</h3><p className="text-sm text-slate-300 leading-relaxed"><LinkifiedText text={currentTasting.pairing} /></p></div>}
                    {currentTasting.notes && <div className="bg-dark-800 p-4 rounded-xl border border-slate-800"><div className="flex justify-between items-center mb-2"><h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2"><Icon name="notes" /> Conclusiones</h3><button onClick={handleCopyNotes} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Icon name="content_copy" className="text-[10px]" /> Copiar</button></div><p className="text-sm text-slate-300 leading-relaxed"><LinkifiedText text={currentTasting.notes} /></p></div>}
                </div>
                {/* COLORED TAGS IMPLEMENTATION */}
                {currentTasting.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {currentTasting.tags.map(tag => {
                            const color = getTagColor(tag);
                            return (
                                <span 
                                    key={tag} 
                                    className="px-2 py-1 rounded-lg text-xs font-bold shadow-sm border border-white/10 text-white"
                                    style={{ backgroundColor: color }}
                                >
                                    #{tag}
                                </span>
                            );
                        })}
                    </div>
                )}
                 
                 {fullImages.length > 1 && (
                    <div className="mt-4 overflow-x-auto flex gap-2 pb-2">
                        {fullImages.map((img, i) => ( <SafeImage key={i} src={img} className="h-24 w-24 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition" alt={`Img ${i}`} onClick={() => setFullscreenIndex(i)} /> ))}
                    </div>
                )}
                
                {/* FOOTER ACTIONS */}
                <div className="flex flex-col gap-3 mt-8 border-t border-slate-800 pt-4">
                    <span className="text-[10px] text-slate-500 text-center">📅 Registrado: {new Date(currentTasting.createdAt).toLocaleDateString()}</span>
                    <div className="flex gap-3">
                        <button onClick={() => duplicateTasting(currentTasting)} className="flex-1 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 text-xs font-bold hover:bg-slate-700 flex items-center justify-center gap-2">
                            <Icon name="content_copy" className="text-sm" /> Clonar Todo
                        </button>
                        <button onClick={handleNewVintage} className="flex-1 py-2 bg-slate-800 border border-slate-700 rounded-xl text-primary-400 text-xs font-bold hover:bg-slate-700 flex items-center justify-center gap-2">
                            <Icon name="history" className="text-sm" /> Nueva Añada
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
