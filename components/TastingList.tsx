
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKataContext } from '../context/KataContext';
import { Icon, SafeImage, VirtualList, EmptyState, ConfirmModal, InputModal, SpeechMic, SwipeableRow } from './Shared';
import { getCountryFlag, getCategoryColor, getAbvVal, getPriceVal, getDrinkingStatus, vibrate } from '../utils/helpers';
import { Tasting } from '../types';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { useDebounce } from '../hooks/useDebounce';

type TabType = 'CELLAR' | 'WISHLIST' | 'HISTORY' | 'LISTS';

// Helper for Date Headers
const getHeaderLabel = (timestamp: number) => {
    const d = new Date(timestamp);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const TastingList = React.memo(() => {
    const { tastings, setView, setSelectedTasting, categories, toggleCompare, compareList, clearCompare, currency, updateStock, showToast, userLists, createList, deleteList, addItemsToList, deleteTastingsBulk, formatScore, toggleFavorite, confirmDelete } = useKataContext();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300); // Debounce delay 300ms

    // --- LEVEL 1 UPDATE: Session Persistence ---
    const [activeTab, setActiveTabState] = useState<TabType>(() => {
        return (sessionStorage.getItem('kata_active_tab') as TabType) || 'HISTORY';
    });

    const setActiveTab = (tab: TabType) => {
        vibrate();
        setActiveTabState(tab);
        sessionStorage.setItem('kata_active_tab', tab);
        if (tab !== 'LISTS') setSelectedListId(null);
    };
    // -------------------------------------------

    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    
    // Filtering State
    const [sort, setSort] = useState<'DATE'|'SCORE_DESC'|'SCORE_ASC'|'PRICE_DESC'|'PRICE_ASC'>('DATE');
    const [filterFav, setFilterFav] = useState(false);
    const [filterCat, setFilterCat] = useState<string | null>(null);
    const [filterCountry, setFilterCountry] = useState<string | null>(null);
    const [abvFilter, setAbvFilter] = useState<'ALL'|'LOW'|'MED'|'HIGH'|'VERY_HIGH'>('ALL');

    // Menu Visibility States
    const [activeMenu, setActiveMenu] = useState<'NONE' | 'CAT' | 'COUNTRY' | 'ABV' | 'SORT'>('NONE');

    const toggleMenu = (menu: 'CAT' | 'COUNTRY' | 'ABV' | 'SORT') => {
        vibrate();
        setActiveMenu(prev => prev === menu ? 'NONE' : menu);
    };

    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    
    const [createListOpen, setCreateListOpen] = useState(false);
    const [addToListOpen, setAddToListOpen] = useState(false);
    const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);

    // --- FUZZY SEARCH ---
    const searchOptions = useMemo(() => ({
        keys: [
            { name: 'name', weight: 0.5 },
            { name: 'producer', weight: 0.3 },
            { name: 'variety', weight: 0.3 },
            { name: 'category', weight: 0.2 },
            { name: 'tags', weight: 0.2 },
            { name: 'notes', weight: 0.1 }
        ],
        threshold: 0.3, 
        ignoreLocation: true
    }), []);

    // Use DEBOUNCED query here
    const searchResults = useFuzzySearch<Tasting>(tastings, debouncedSearch, searchOptions);

    const countries = useMemo(() => Array.from(new Set(tastings.map(t => t.country).filter(Boolean))), [tastings]);

    const filteredTastings = useMemo(() => {
        let res = searchResults;
        
        if (activeTab === 'CELLAR') {
            res = res.filter(t => (t.stock || 0) > 0 || t.openDate);
        } else if (activeTab === 'WISHLIST') {
            // Fix: Show ALL items marked as wishlist, regardless of stock
            res = res.filter(t => t.isWishlist);
        } else if (activeTab === 'LISTS') {
            if (selectedListId) {
                const list = userLists.find(l => l.id === selectedListId);
                if (list) res = res.filter(t => list.itemIds.includes(t.id));
                else res = [];
            } else {
                return []; 
            }
        }

        if (filterFav) res = res.filter(t => t.isFavorite);
        if (filterCat) res = res.filter(t => t.category === filterCat);
        if (filterCountry) res = res.filter(t => t.country === filterCountry);
        if (abvFilter !== 'ALL') {
             res = res.filter(t => {
                 const val = getAbvVal(t.abv);
                 if (abvFilter === 'LOW') return val <= 15;
                 if (abvFilter === 'MED') return val > 15 && val <= 30;
                 if (abvFilter === 'HIGH') return val > 30 && val <= 40;
                 return val > 40; 
             });
        }
        return res.sort((a,b) => {
             if (activeTab === 'CELLAR') {
                 if (a.openDate && !b.openDate) return -1;
                 if (!a.openDate && b.openDate) return 1;
             }
             if (sort === 'SCORE_DESC') return b.score - a.score;
             if (sort === 'SCORE_ASC') return a.score - b.score;
             if (sort === 'PRICE_DESC') return getPriceVal(b.price) - getPriceVal(a.price);
             if (sort === 'PRICE_ASC') return getPriceVal(a.price) - getPriceVal(b.price);
             return b.createdAt - a.createdAt;
        });
    }, [searchResults, sort, filterFav, activeTab, filterCat, filterCountry, abvFilter, selectedListId, userLists]);

    // --- GROUPING LOGIC FOR HEADERS ---
    const itemsWithHeaders = useMemo(() => {
        // Only show headers if sorted by Date and no text search (to keep it clean)
        if (sort !== 'DATE' || debouncedSearch) return filteredTastings;

        const result: any[] = [];
        let lastHeader = '';

        filteredTastings.forEach(t => {
            const header = getHeaderLabel(t.createdAt);
            if (header !== lastHeader) {
                result.push({ isHeader: true, id: `header-${header}`, label: header });
                lastHeader = header;
            }
            result.push(t);
        });
        return result;
    }, [filteredTastings, sort, debouncedSearch]);


    const toggleSelection = (id: string) => {
        vibrate();
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItems(newSet);
        if (newSet.size === 0) setIsSelectionMode(false);
    };

    const handleLongPress = (id: string) => {
        vibrate(50);
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedItems(new Set([id]));
        }
    };

    const handleQuickDrink = (e: React.MouseEvent, t: Tasting) => {
        e.stopPropagation();
        if ((t.stock || 0) > 0) {
            updateStock(t, -1);
            showToast(`Bebiste ${t.name}. Stock: ${(t.stock||0)-1}`, 'info');
        }
    };

    const handleBulkDelete = () => {
        deleteTastingsBulk(Array.from(selectedItems));
        setIsSelectionMode(false);
        setSelectedItems(new Set());
        setConfirmBulkDeleteOpen(false);
    };
    
    const handleAddSelectedToList = (listId: string) => {
        addItemsToList(listId, Array.from(selectedItems));
        setIsSelectionMode(false);
        setSelectedItems(new Set());
        setAddToListOpen(false);
    };

    const renderItem = (item: any) => {
        // Render Header
        if (item.isHeader) {
            return (
                <div className="sticky top-0 z-10 bg-white/95 dark:bg-dark-950/95 backdrop-blur py-2 px-1 mb-2 border-b border-slate-200 dark:border-slate-800/50 flex items-center">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">{item.label}</span>
                </div>
            );
        }

        const t = item as Tasting;
        const isComparing = compareList.includes(t.id);
        const hasStock = (t.stock || 0) > 0;
        const isSelected = selectedItems.has(t.id);
        const isOpen = !!t.openDate;
        const drinkingStatus = getDrinkingStatus(t.drinkFrom, t.drinkTo);

        // Content Component
        const Content = (
            <div 
                onClick={() => { 
                    if (isSelectionMode) toggleSelection(t.id);
                    else if(compareList.length > 0) toggleCompare(t.id); 
                    else { 
                        vibrate();
                        setSelectedTasting(t); 
                        navigate(`/tasting/${t.id}`);
                    } 
                }} 
                onContextMenu={(e) => { e.preventDefault(); handleLongPress(t.id); }}
                className={`flex bg-white dark:bg-dark-800 p-2 rounded-xl border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer active:scale-[0.99] relative select-none h-full ${isSelected ? 'border-primary-500 bg-primary-50 dark:bg-slate-800 ring-1 ring-primary-500' : isOpen ? 'border-orange-500/50 bg-orange-50 dark:bg-slate-800/80' : 'border-slate-200 dark:border-slate-800'}`}
            >
                <div className="w-20 h-20 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0 relative">
                     {t.thumbnail || t.images[0] ? <SafeImage src={t.thumbnail || t.images[0]} className="w-full h-full object-cover" alt={t.name} /> : <div className="w-full h-full flex items-center justify-center"><Icon name="image" className="text-slate-400 dark:text-slate-500" /></div>}
                     <div className="absolute bottom-0 left-0 w-1 bg-white/50 h-full" style={{ backgroundColor: getCategoryColor(t.category, categories) }}></div>
                     {isSelectionMode && (
                        <div className={`absolute inset-0 flex items-center justify-center z-[100] transition-all duration-200 ${isSelected ? 'bg-black/60 backdrop-blur-[1px]' : 'bg-transparent'}`}>
                            {isSelected ? (
                                <Icon name="check_circle" className="text-green-500 text-4xl drop-shadow-xl scale-110 bg-white rounded-full" />
                            ) : (
                                <div className="w-6 h-6 rounded-full border-2 border-white/50 bg-black/20 shadow-sm"></div>
                            )}
                        </div>
                     )}
                </div>
                <div className="ml-3 flex-1 flex flex-col justify-between py-1 min-w-0">
                    <div>
                        <div className="flex justify-between items-start">
                             <h3 className="font-bold text-sm line-clamp-2 leading-tight flex-1 text-slate-900 dark:text-white">{t.name}</h3>
                             {t.isWishlist ? (
                                 <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 flex-shrink-0 ml-1">DESEOS</span>
                             ) : (
                                 <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-1 ${t.score >= 8 ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'}`}>{formatScore(t.score)}</span>
                             )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{t.producer || t.category}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-slate-500 dark:text-slate-500 truncate">{t.country} {getCountryFlag(t.country)} • {t.vintage}</p>
                            {!t.isWishlist && drinkingStatus !== 'UNKNOWN' && (
                                <div className="flex items-center" title={drinkingStatus === 'READY' ? 'Listo' : drinkingStatus === 'HOLD' ? 'Guardar' : 'Pasado'}>
                                    <span className={`w-2 h-2 rounded-full ${drinkingStatus === 'READY' ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : drinkingStatus === 'HOLD' ? 'bg-blue-500' : 'bg-red-500'}`}></span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{currency} {t.price}</span>
                        <div className="flex items-center gap-2">
                             {activeTab === 'CELLAR' && hasStock && !compareList.length && !isSelectionMode && !isOpen && (
                                <button 
                                    onClick={(e) => handleQuickDrink(e, t)}
                                    className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 hover:bg-red-600 dark:hover:bg-red-600 border border-red-200 dark:border-red-500/30 hover:border-red-500 text-red-500 dark:text-red-400 hover:text-white flex items-center justify-center transition active:scale-95 shadow-sm"
                                    title="Beber una"
                                    aria-label="Beber una"
                                >
                                    <span className="text-[10px] font-bold leading-none">-1</span>
                                </button>
                            )}
                            
                            {isOpen ? (
                                <span className="text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-500/30 shadow-sm flex items-center gap-1">
                                    <Icon name="timelapse" className="text-[10px]" /> Abierta
                                </span>
                            ) : (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${hasStock ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>{hasStock ? `Stock: ${t.stock}` : 'Agotado'}</span>
                            )}
                            
                            {t.isFavorite && <Icon name="star" className="text-xs text-yellow-500" />}
                        </div>
                    </div>
                </div>
                {compareList.length > 0 && !isSelectionMode && (
                    <div className="absolute top-2 right-2">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isComparing ? 'bg-primary-500 border-primary-500' : 'border-slate-400 dark:border-slate-500'}`}>
                            {isComparing && <Icon name="check" className="text-white text-xs" />}
                        </div>
                    </div>
                )}
            </div>
        );

        // Wrap with SwipeableRow if not selection mode
        if (!isSelectionMode && !isComparing) {
            return (
                <SwipeableRow 
                    key={t.id} 
                    onSwipeRight={() => toggleFavorite(t)} 
                    onSwipeLeft={() => confirmDelete(t.id)}
                >
                    {Content}
                </SwipeableRow>
            );
        }

        return <div key={t.id} className="mb-3">{Content}</div>;
    };

    const renderListCard = (list: any) => (
        <div key={list.id} onClick={() => setSelectedListId(list.id)} className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer mb-3 relative group">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{list.name}</h3>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600">{list.itemIds.length} items</span>
            </div>
            <p className="text-xs text-slate-500">Creada: {new Date(list.createdAt).toLocaleDateString()}</p>
            <button 
                onClick={(e) => { e.stopPropagation(); deleteList(list.id); }}
                className="absolute top-4 right-4 text-red-400 opacity-0 group-hover:opacity-100 transition p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                aria-label="Borrar lista"
            >
                <Icon name="delete" />
            </button>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-transparent pb-24 relative">
            <div className="p-4 bg-white/95 dark:bg-dark-900/95 backdrop-blur sticky top-0 z-10 space-y-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex gap-2 bg-slate-100 dark:bg-dark-800 p-1 rounded-xl mb-1 overflow-x-auto scrollbar-hide">
                    {['HISTORY', 'WISHLIST', 'CELLAR', 'LISTS'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as TabType)} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === tab ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-white shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-400'}`}>
                            <Icon name={tab === 'HISTORY' ? 'history' : tab === 'WISHLIST' ? 'card_giftcard' : tab === 'CELLAR' ? 'kitchen' : 'list'} className="text-sm" /> 
                            {tab === 'HISTORY' ? 'Todo' : tab === 'WISHLIST' ? 'Deseos' : tab === 'CELLAR' ? 'Bodega' : 'Listas'}
                        </button>
                    ))}
                </div>
                
                {!(activeTab === 'LISTS' && !selectedListId) && (
                    <>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedItems(new Set()); }}
                                className={`w-12 h-12 rounded-xl flex items-center justify-center border transition ${isSelectionMode ? 'bg-primary-600 text-white border-primary-500 shadow-lg scale-105' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}
                                aria-label="Modo selección"
                            >
                                <Icon name="checklist" />
                            </button>
                            <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl flex items-center px-3 border border-slate-200 dark:border-slate-700">
                                <Icon name="search" className="text-slate-400" />
                                <input id="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="bg-transparent w-full p-3 text-slate-900 dark:text-white outline-none placeholder:text-slate-500" aria-label="Buscar catas" />
                                {search && <button onClick={() => setSearch('')} aria-label="Borrar búsqueda"><Icon name="close" className="text-slate-400" /></button>}
                                <div className="pl-2 border-l border-slate-200 dark:border-slate-700">
                                    <SpeechMic onResult={(txt) => setSearch(txt)} />
                                </div>
                            </div>
                            <button onClick={() => { if (filteredTastings.length > 0) { const rand = filteredTastings[Math.floor(Math.random() * filteredTastings.length)]; setSelectedTasting(rand); navigate(`/tasting/${rand.id}`); } }} className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-95" aria-label="Aleatorio"><Icon name="casino" /></button>
                        </div>

                        {/* --- SMART CHIPS BAR --- */}
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide items-center">
                            
                            {/* Favorites Chip */}
                            <button 
                                onClick={() => setFilterFav(!filterFav)} 
                                className={`flex items-center justify-center px-2 py-1.5 rounded-full text-xs font-bold border transition flex-shrink-0 active:scale-95 ${filterFav ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/50' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                                title="Favoritos"
                                aria-label="Filtrar favoritos"
                            >
                                <Icon name={filterFav ? "star" : "star_border"} className="text-sm" />
                            </button>

                            {/* Category Chip */}
                            <button 
                                onClick={() => toggleMenu('CAT')} 
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap flex-shrink-0 active:scale-95 ${filterCat || activeMenu === 'CAT' ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 border-primary-300 dark:border-primary-500/50 pr-2' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                            >
                                <Icon name="category" className="text-sm" />
                                {(filterCat || activeMenu === 'CAT') && (
                                    <>
                                        <span className="animate-fade-in">{filterCat || 'Categoría'}</span>
                                        {filterCat && (
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); setFilterCat(null); }}
                                                className="bg-primary-500/20 hover:bg-primary-500/40 rounded-full p-0.5 ml-1"
                                            >
                                                <Icon name="close" className="text-xs block" />
                                            </div>
                                        )}
                                    </>
                                )}
                            </button>

                            {/* Country Chip */}
                            <button 
                                onClick={() => toggleMenu('COUNTRY')} 
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap flex-shrink-0 active:scale-95 ${filterCountry || activeMenu === 'COUNTRY' ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border-green-300 dark:border-green-500/50 pr-2' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                            >
                                {filterCountry ? <span className="text-sm">{getCountryFlag(filterCountry)}</span> : <Icon name="public" className="text-sm" />}
                                {(filterCountry || activeMenu === 'COUNTRY') && (
                                    <>
                                        <span className="animate-fade-in">{filterCountry || 'País'}</span>
                                        {filterCountry && (
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); setFilterCountry(null); }}
                                                className="bg-green-500/20 hover:bg-green-500/40 rounded-full p-0.5 ml-1"
                                            >
                                                <Icon name="close" className="text-xs block" />
                                            </div>
                                        )}
                                    </>
                                )}
                            </button>

                            {/* ABV Chip */}
                            <button 
                                onClick={() => toggleMenu('ABV')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap flex-shrink-0 active:scale-95 ${abvFilter !== 'ALL' || activeMenu === 'ABV' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-500/50 pr-2' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                            >
                                <Icon name="science" className="text-sm" />
                                {(abvFilter !== 'ALL' || activeMenu === 'ABV') && (
                                    <>
                                        <span className="animate-fade-in">
                                            {abvFilter === 'ALL' ? 'Graduación' : 
                                            abvFilter === 'LOW' ? '<15%' : 
                                            abvFilter === 'MED' ? '15-30%' : 
                                            abvFilter === 'HIGH' ? '30-40%' : '>40%'}
                                        </span>
                                        {abvFilter !== 'ALL' && (
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); setAbvFilter('ALL'); }}
                                                className="bg-orange-500/20 hover:bg-orange-500/40 rounded-full p-0.5 ml-1"
                                            >
                                                <Icon name="close" className="text-xs block" />
                                            </div>
                                        )}
                                    </>
                                )}
                            </button>

                            {/* Sort Chip */}
                            <button 
                                onClick={() => toggleMenu('SORT')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap flex-shrink-0 active:scale-95 ${activeMenu === 'SORT' || sort !== 'DATE' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-500/50' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                            >
                                <Icon name="sort" className="text-sm" />
                                {(sort !== 'DATE' || activeMenu === 'SORT') && (
                                    <span className="animate-fade-in">
                                        {sort === 'DATE' ? 'Recientes' :
                                         sort === 'SCORE_DESC' ? 'Top Rated' :
                                         sort === 'SCORE_ASC' ? 'Low Rated' :
                                         sort === 'PRICE_DESC' ? '$$$ > $' : '$ > $$$'}
                                    </span>
                                )}
                            </button>
                        </div>
                    </>
                )}

                {activeTab === 'LISTS' && selectedListId && (
                     <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setSelectedListId(null)} className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"><Icon name="arrow_back" /></button>
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">{userLists.find(l=>l.id===selectedListId)?.name}</h3>
                     </div>
                )}
                
                {/* --- EXPANDABLE FILTER MENUS --- */}
                
                {activeMenu === 'CAT' && (
                    <div className="bg-white dark:bg-dark-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-4 gap-2 animate-slide-up shadow-xl">
                        <button onClick={() => { setFilterCat(null); setActiveMenu('NONE'); }} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs text-slate-800 dark:text-white">Todos</button>
                        {categories.map(c => (
                            <button key={c.id} onClick={() => { setFilterCat(c.name); setActiveMenu('NONE'); }} className={`p-2 rounded-lg text-xs flex flex-col items-center gap-1 ${filterCat === c.name ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                <Icon name={c.icon || 'circle'} />
                                <span className="truncate w-full text-center">{c.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {activeMenu === 'COUNTRY' && (
                    <div className="bg-white dark:bg-dark-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-2 animate-slide-up shadow-xl">
                        <button onClick={() => { setFilterCountry(null); setActiveMenu('NONE'); }} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs text-slate-800 dark:text-white">Todos</button>
                        {countries.map(c => (
                            <button key={c} onClick={() => { setFilterCountry(c); setActiveMenu('NONE'); }} className={`p-2 rounded-lg text-xs flex items-center gap-2 ${filterCountry === c ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                <span>{getCountryFlag(c)}</span>
                                <span className="truncate">{c}</span>
                            </button>
                        ))}
                    </div>
                )}

                {activeMenu === 'ABV' && (
                    <div className="bg-white dark:bg-dark-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 animate-slide-up shadow-xl">
                        {[
                            { label: 'Cualquiera', val: 'ALL' },
                            { label: 'Baja (<15%)', val: 'LOW' },
                            { label: 'Media (15-30%)', val: 'MED' },
                            { label: 'Alta (30-40%)', val: 'HIGH' },
                            { label: 'Muy Alta (>40%)', val: 'VERY_HIGH' }
                        ].map(opt => (
                            <button 
                                key={opt.val} 
                                onClick={() => { setAbvFilter(opt.val as any); setActiveMenu('NONE'); }} 
                                className={`p-3 rounded-lg text-xs font-bold ${abvFilter === opt.val ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}

                {activeMenu === 'SORT' && (
                    <div className="bg-white dark:bg-dark-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 gap-2 animate-slide-up shadow-xl">
                        {[
                            { label: '📅 Más Recientes', val: 'DATE' },
                            { label: '⭐ Mejor Puntuación', val: 'SCORE_DESC' },
                            { label: '👎 Peor Puntuación', val: 'SCORE_ASC' },
                            { label: '💰 Mayor Precio', val: 'PRICE_DESC' },
                            { label: '💸 Menor Precio', val: 'PRICE_ASC' }
                        ].map(opt => (
                            <button 
                                key={opt.val} 
                                onClick={() => { setSort(opt.val as any); setActiveMenu('NONE'); }} 
                                className={`p-3 rounded-lg text-xs font-bold text-left ${sort === opt.val ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="flex-1 relative">
                {activeTab === 'LISTS' && !selectedListId ? (
                    <div className="p-4">
                        <button onClick={() => setCreateListOpen(true)} className="w-full py-4 mb-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-white transition">
                            <Icon name="add_circle" /> Crear Nueva Lista
                        </button>
                        {userLists.map(renderListCard)}
                        {userLists.length === 0 && <p className="text-center text-slate-500 mt-8">Crea listas para organizar tus catas.</p>}
                    </div>
                ) : itemsWithHeaders.length > 0 ? (
                    <VirtualList id="tasting-list-container" items={itemsWithHeaders} height={window.innerHeight - 300} itemHeight={96} renderItem={renderItem} />
                ) : (
                    <EmptyState message={activeTab === 'CELLAR' ? "Tu bodega está vacía" : activeTab === 'WISHLIST' ? "Lista de deseos vacía" : activeTab === 'LISTS' ? "Lista vacía" : "No se encontraron bebidas"} icon={activeTab === 'CELLAR' ? "kitchen" : "search"} />
                )}
                
                <button 
                    onClick={() => {
                        // First try to scroll the virtual list container
                        const vList = document.getElementById('tasting-list-container');
                        if (vList) {
                            vList.scrollTo({ top: 0, behavior: 'smooth' });
                        } else {
                            // Fallback to main layout scroll (for empty states or non-virtual lists)
                            const main = document.querySelector('main');
                            if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }} 
                    className="absolute bottom-4 right-4 w-10 h-10 bg-slate-200/80 dark:bg-slate-700/80 backdrop-blur rounded-full flex items-center justify-center text-slate-600 dark:text-white shadow-lg z-10 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition"
                    aria-label="Volver arriba"
                >
                    <Icon name="arrow_upward" />
                </button>
            </div>
            
            {isSelectionMode && selectedItems.size > 0 && (
                <div className="fixed bottom-24 left-4 right-4 z-30 bg-white/90 dark:bg-primary-900/90 backdrop-blur border border-primary-200 dark:border-primary-500 p-4 rounded-xl shadow-2xl animate-slide-up flex items-center justify-between">
                    <span className="text-slate-800 dark:text-white font-bold">{selectedItems.size} seleccionados</span>
                    <div className="flex gap-2">
                        <button onClick={() => setAddToListOpen(true)} className="bg-primary-600 dark:bg-white text-white dark:text-primary-900 px-4 py-2 rounded-lg font-bold text-xs shadow hover:opacity-90 flex items-center gap-2">
                            <Icon name="playlist_add" /> Añadir a Lista
                        </button>
                        <button onClick={() => setConfirmBulkDeleteOpen(true)} className="bg-red-600 text-white p-2 rounded-lg shadow hover:bg-red-500" aria-label="Eliminar seleccionados">
                            <Icon name="delete" />
                        </button>
                    </div>
                </div>
            )}
            
            <InputModal isOpen={createListOpen} title="Nueva Lista" initialValue="" onConfirm={(name) => { if(name) createList(name); setCreateListOpen(false); }} onCancel={() => setCreateListOpen(false)} />
            <ConfirmModal isOpen={confirmBulkDeleteOpen} title="Eliminar Elementos" message={`¿Estás seguro de eliminar ${selectedItems.size} catas?`} onConfirm={handleBulkDelete} onCancel={() => setConfirmBulkDeleteOpen(false)} />
            {addToListOpen && (
                 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4">
                    <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm transform scale-100 animate-slide-up">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">Añadir a Lista</h3><button onClick={() => setAddToListOpen(false)}><Icon name="close" className="text-slate-400" /></button></div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {userLists.map(l => (
                                <button key={l.id} onClick={() => handleAddSelectedToList(l.id)} className="w-full text-left p-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-slate-800 dark:text-white font-bold">
                                    {l.name}
                                </button>
                            ))}
                            {userLists.length === 0 && <p className="text-slate-500 text-sm">No tienes listas creadas.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
