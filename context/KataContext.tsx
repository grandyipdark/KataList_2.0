
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tasting, Category, UserList, ViewState, UserProfile } from '../types';
import { useTastingData } from '../hooks/useTastingData';
import { useCloudSync } from '../hooks/useCloudSync';
import { getUserProfile } from '../services/gamificationService';
import { storageService } from '../services/storageService';
import { ToastContainer, ToastMessage, ConfirmModal } from '../components/Shared';

export type ScoreScaleType = '10' | '100';

interface KataContextType {
    tastings: Tasting[];
    categories: Category[];
    userLists: UserList[];
    selectedTasting: Tasting | null;
    compareList: string[];
    allTags: string[];
    setSelectedTasting: (t: Tasting | null) => void;
    saveTasting: (t: Tasting) => Promise<void>;
    deleteTasting: (id: string) => Promise<void>;
    duplicateTasting: (t: Tasting) => Promise<void>;
    duplicateTastingAsVintage: (t: Tasting) => Promise<string>;
    toggleFavorite: (t: Tasting) => Promise<void>;
    updateStock: (t: Tasting, delta: number) => Promise<void>;
    updateCategories: (cats: Category[]) => Promise<void>;
    updateTags: (oldTag: string, newTag: string | null) => Promise<void>;
    renameProducer: (oldName: string, newName: string) => Promise<void>;
    optimizeTagsBulk: () => Promise<void>;
    mergeTastings: (sourceId: string, targetId: string) => Promise<void>;
    createList: (name: string) => Promise<void>;
    deleteList: (id: string) => Promise<void>;
    addItemsToList: (listId: string, itemIds: string[]) => Promise<void>;
    deleteTastingsBulk: (ids: string[]) => Promise<void>;
    exportData: (includeImages?: boolean) => Promise<string>;
    importData: (json: string) => Promise<boolean>;
    exportCSV: () => Promise<void>;
    toggleCompare: (id: string) => void;
    clearCompare: () => void;
    
    // UI State
    view: ViewState;
    setView: (v: ViewState) => void;
    isOledMode: boolean;
    toggleOledMode: () => void;
    isLightMode: boolean;
    toggleLightMode: () => void;
    currency: string;
    setCurrency: (c: string) => void;
    accentColor: string;
    setAccentColor: (c: string) => void;
    scoreScale: ScoreScaleType;
    setScoreScale: (s: ScoreScaleType) => void;
    formatScore: (score: number) => string;
    
    // Gamification
    userProfile: UserProfile;
    
    // Cloud
    isCloudConnected: boolean;
    cloudLastSync: string | null;
    isSyncing: 'idle' | 'connecting' | 'uploading' | 'downloading' | 'syncing';
    connectCloud: () => Promise<void>;
    uploadToCloud: (force?: boolean) => Promise<any>;
    downloadFromCloud: () => Promise<void>;
    
    // Misc
    showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
    confirmDelete: (id: string) => void;
    isInitializing: boolean;
    installPrompt: any;
    installApp: () => void;
}

const KataContext = createContext<KataContextType | undefined>(undefined);

export const useKataContext = () => {
    const context = useContext(KataContext);
    if (!context) throw new Error("useKataContext must be used within KataProvider");
    return context;
};

export const KataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const [isInitializing, setIsInitializing] = useState(true);
    const [view, setViewState] = useState<ViewState>('DASHBOARD');
    const [isOledMode, setIsOledMode] = useState(() => localStorage.getItem('kata_oled') === 'true');
    const [isLightMode, setIsLightMode] = useState(() => localStorage.getItem('kata_light') === 'true');
    const [currency, setCurrencyState] = useState(() => localStorage.getItem('kata_currency') || '$');
    const [accentColor, setAccentColorState] = useState(() => localStorage.getItem('kata_accent') || '#3b82f6');
    const [scoreScale, setScoreScaleState] = useState<ScoreScaleType>(() => (localStorage.getItem('kata_score_scale') as ScoreScaleType) || '10');
    
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [installPrompt, setInstallPrompt] = useState<any>(null);

    const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, text, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    }, []);

    // Función setView mejorada para manejar navegación real
    const setView = useCallback((v: ViewState) => {
        setViewState(v);
        
        const routeMap: Partial<Record<ViewState, string>> = {
            'DASHBOARD': '/',
            'SEARCH': '/search',
            'NEW': '/new',
            'AI_CHAT': '/chat',
            'CATEGORIES': '/categories',
            'PROFILE': '/profile',
            'INSIGHTS': '/insights',
            'CHEF': '/chef',
            'MAP': '/map',
            'MIXOLOGY': '/mixology',
            'MERGE': '/merge'
        };

        if (routeMap[v]) {
            navigate(routeMap[v]!);
        }
        
        window.scrollTo(0, 0);
    }, [navigate]);

    const { 
        tastings, categories, userLists, selectedTasting, compareList,
        setSelectedTasting, refreshData, saveTasting, deleteTasting, duplicateTasting, duplicateTastingAsVintage, toggleFavorite,
        updateStock, updateCategories, updateTags, renameProducer, optimizeTagsBulk, mergeTastings,
        createList, deleteList, addItemsToList, deleteTastingsBulk,
        exportData, importData, exportCSV, toggleCompare, clearCompare 
    } = useTastingData(showToast, setView);

    const { isCloudConnected, cloudLastSync, isSyncing, connectCloud, uploadToCloud, downloadFromCloud } = useCloudSync(showToast, exportData, importData, tastings);

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        tastings.forEach(t => t.tags.forEach(tag => tags.add(tag)));
        return Array.from(tags).sort();
    }, [tastings]);

    const userProfile = useMemo(() => getUserProfile(tastings), [tastings]);

    useEffect(() => {
        storageService.init().then(() => {
            refreshData().then(() => {
                setIsInitializing(false);
            });
        });

        const handlePrompt = (e: any) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handlePrompt);
        return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
    }, [refreshData]);

    const installApp = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') setInstallPrompt(null);
    };

    const toggleOledMode = () => {
        const newVal = !isOledMode;
        setIsOledMode(newVal);
        localStorage.setItem('kata_oled', String(newVal));
    };

    const toggleLightMode = () => {
        const newVal = !isLightMode;
        setIsLightMode(newVal);
        localStorage.setItem('kata_light', String(newVal));
        if (newVal) document.documentElement.classList.remove('dark');
        else document.documentElement.classList.add('dark');
    };

    useEffect(() => {
        if (isLightMode) document.documentElement.classList.remove('dark');
        else document.documentElement.classList.add('dark');
    }, [isLightMode]);

    const setCurrency = (c: string) => {
        setCurrencyState(c);
        localStorage.setItem('kata_currency', c);
    };

    const setAccentColor = (c: string) => {
        setAccentColorState(c);
        localStorage.setItem('kata_accent', c);
        document.documentElement.style.setProperty('--color-primary-500', c);
    };

    const setScoreScale = (s: ScoreScaleType) => {
        setScoreScaleState(s);
        localStorage.setItem('kata_score_scale', s);
    };

    const formatScore = (score: number) => {
        if (scoreScale === '100') return Math.round(score * 10).toString();
        return score.toFixed(1);
    };

    const confirmDelete = (id: string) => setDeleteConfirmId(id);

    const value = {
        tastings, categories, userLists, selectedTasting, compareList, allTags,
        setSelectedTasting, saveTasting, deleteTasting, duplicateTasting, duplicateTastingAsVintage, toggleFavorite,
        updateStock, updateCategories, updateTags, renameProducer, optimizeTagsBulk, mergeTastings,
        createList, deleteList, addItemsToList, deleteTastingsBulk,
        exportData, importData, exportCSV, toggleCompare, clearCompare,
        view, setView, isOledMode, toggleOledMode, isLightMode, toggleLightMode, currency, setCurrency, accentColor, setAccentColor,
        scoreScale, setScoreScale, formatScore, userProfile, isCloudConnected, cloudLastSync, isSyncing, connectCloud, uploadToCloud, downloadFromCloud,
        showToast, confirmDelete, isInitializing, installPrompt, installApp
    };

    return (
        <KataContext.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
            <ConfirmModal 
                isOpen={!!deleteConfirmId} 
                title="Eliminar Cata" 
                message="¿Estás seguro de que quieres eliminar este registro permanentemente?" 
                onConfirm={() => { if (deleteConfirmId) deleteTasting(deleteConfirmId); setDeleteConfirmId(null); }} 
                onCancel={() => setDeleteConfirmId(null)} 
            />
        </KataContext.Provider>
    );
};
