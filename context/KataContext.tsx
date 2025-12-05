
import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tasting, Category, ViewState, UserList, UserProfile } from '../types';
import { storageService } from '../services/storageService';
import { vibrate } from '../utils/helpers';
import { getUserProfile } from '../services/gamificationService';
import { ToastMessage, ToastContainer, ConfirmModal, Confetti } from '../components/Shared';
import { useTastingData } from '../hooks/useTastingData';
import { useCloudSync } from '../hooks/useCloudSync';

export type ScoreScaleType = '10' | '100' | '5';

interface KataContextType {
  // Data
  tastings: Tasting[]; categories: Category[]; userLists: UserList[]; 
  selectedTasting: Tasting | null; compareList: string[];
  
  // UI State
  view: ViewState; isInitializing: boolean; isOledMode: boolean; isLightMode: boolean;
  currency: string; accentColor: string; 
  scoreScale: ScoreScaleType; 
  userProfile: UserProfile; showConfetti: boolean;
  isCloudConnected: boolean; cloudLastSync: string | null;
  installPrompt: any; // PWA Install Prompt

  // Actions
  setView: (v: ViewState) => void;
  setSelectedTasting: (t: Tasting | null) => void;
  toggleOledMode: () => void; 
  toggleLightMode: () => void;
  setCurrency: (c: string) => void; setAccentColor: (c: string) => void;
  setScoreScale: (s: ScoreScaleType) => void; 
  installApp: () => void;
  
  refreshData: () => Promise<void>; 
  saveTasting: (t: Tasting) => Promise<void>; 
  deleteTasting: (id: string) => Promise<void>; 
  duplicateTasting: (t: Tasting) => Promise<void>; 
  duplicateTastingAsVintage: (t: Tasting) => Promise<string>;
  toggleFavorite: (t: Tasting) => Promise<void>; 
  updateStock: (t: Tasting, delta: number) => Promise<void>; 
  updateCategories: (c: Category[]) => Promise<void>; 
  updateTags: (oldTag: string, newTag: string | null) => Promise<void>; 
  renameProducer: (oldName: string, newName: string) => Promise<void>;
  importData: (json: string) => Promise<boolean>; 
  exportData: (includeImages?: boolean) => Promise<string>; 
  exportCSV: () => Promise<void>; 
  
  showToast: (msg: string, type: 'success'|'error'|'info') => void; 
  confirmDelete: (id: string) => void;
  
  toggleCompare: (id: string) => void; clearCompare: () => void; optimizeTagsBulk: () => Promise<void>;
  createList: (name: string) => Promise<void>; deleteList: (id: string) => Promise<void>; addItemsToList: (listId: string, itemIds: string[]) => Promise<void>; 
  deleteTastingsBulk: (ids: string[]) => Promise<void>; mergeTastings: (sourceId: string, targetId: string) => Promise<void>;
  
  connectCloud: () => Promise<void>; uploadToCloud: () => Promise<void>; downloadFromCloud: () => Promise<void>;
  
  // Helpers
  formatScore: (score: number) => string;
  allTags: string[]; // Exposed for autocomplete
}

const KataContext = createContext<KataContextType | null>(null);

export const useKataContext = () => { const context = useContext(KataContext); if (!context) throw new Error("useKataContext must be used within a KataProvider"); return context; };

export const KataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  
  // --- UI State (The Shell) ---
  const [view, setViewState] = useState<ViewState>('DASHBOARD');
  const [isInitializing, setIsInitializing] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isOledMode, setIsOledMode] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false); // Default Dark (false)
  const [currency, setCurrencyState] = useState('$');
  const [accentColor, setAccentColorState] = useState('#3b82f6');
  const [scoreScale, setScoreScaleState] = useState<ScoreScaleType>('10');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  // Modals & Effects
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(0); 
  
  // --- Helper Functions ---
  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, text, type }]);
      if(type === 'error') vibrate(50);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // --- Logic Composition (Using Hooks) ---
  const setViewWrapper = useCallback((v: ViewState) => {
      vibrate();
      setViewState(v);
      switch(v) {
          case 'DASHBOARD': navigate('/'); break;
          case 'SEARCH': navigate('/search'); break;
          case 'NEW': navigate('/new'); break;
          case 'CATEGORIES': navigate('/categories'); break;
          case 'AI_CHAT': navigate('/chat'); break;
          case 'GUIDED': navigate('/guided'); break;
          case 'COMPARE': navigate('/compare'); break;
          case 'INSIGHTS': navigate('/insights'); break;
          case 'PROFILE': navigate('/profile'); break;
          case 'CHEF': navigate('/chef'); break;
          case 'BLIND': navigate('/blind'); break;
          case 'MERGE': navigate('/merge'); break;
          case 'MAP': navigate('/map'); break;
          case 'MIXOLOGY': navigate('/mixology'); break;
          case 'DETAIL': 
             break;
          default: navigate('/');
      }
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTo(0, 0);
  }, [navigate]);

  // Hook 1: Data Management
  const {
      tastings, categories, userLists, selectedTasting, compareList,
      setSelectedTasting, refreshData, saveTasting, deleteTasting, duplicateTasting, duplicateTastingAsVintage, toggleFavorite,
      updateStock, updateCategories, updateTags, renameProducer, optimizeTagsBulk, mergeTastings,
      createList, deleteList, addItemsToList, deleteTastingsBulk,
      exportData, importData, exportCSV, toggleCompare, clearCompare
  } = useTastingData(showToast, setViewWrapper);

  // Hook 2: Cloud
  const { isCloudConnected, cloudLastSync, connectCloud, uploadToCloud, downloadFromCloud } = useCloudSync(showToast, exportData, importData);


  // --- Initialization & Preferences ---
  useEffect(() => {
    const init = async () => {
      await storageService.init();
      await refreshData();
      
      const savedOled = localStorage.getItem('katalist_oled');
      if (savedOled === 'true') setIsOledMode(true);
      
      // Light Mode Logic
      const savedLight = localStorage.getItem('katalist_light');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (savedLight === 'true') {
          setIsLightMode(true);
          document.documentElement.classList.remove('dark');
      } else {
          // Default to Dark if not specified or specified false
          setIsLightMode(false);
          document.documentElement.classList.add('dark');
      }
      
      const savedCurr = localStorage.getItem('katalist_currency');
      if (savedCurr) setCurrencyState(savedCurr);
      
      const savedAccent = localStorage.getItem('katalist_accent');
      if (savedAccent) applyAccentColor(savedAccent);

      const savedScale = localStorage.getItem('katalist_scale');
      if (savedScale) setScoreScaleState(savedScale as ScoreScaleType);
      
      setIsInitializing(false);
    };
    init();
  }, [refreshData]);

  // --- PWA Install Listener ---
  useEffect(() => {
      const handler = (e: any) => {
          e.preventDefault();
          setInstallPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const installApp = useCallback(async () => {
      if (!installPrompt) return;
      vibrate();
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
          setInstallPrompt(null);
      }
  }, [installPrompt]);

  // --- Wrappers for Actions with Side Effects (Backup Reminder) ---
  const checkBackupReminder = useCallback(() => {
      setUnsavedChanges(prev => {
          const next = prev + 1;
          if (next >= 10) {
              showToast("¡Exporta un Backup!", 'info');
              return 0;
          }
          return next;
      });
  }, [showToast]);

  const saveTastingWrapped = useCallback(async (t: Tasting) => { await saveTasting(t); checkBackupReminder(); }, [saveTasting, checkBackupReminder]);
  const deleteTastingWrapped = useCallback(async (id: string) => { await deleteTasting(id); checkBackupReminder(); }, [deleteTasting, checkBackupReminder]);
  const duplicateTastingWrapped = useCallback(async (t: Tasting) => { await duplicateTasting(t); checkBackupReminder(); }, [duplicateTasting, checkBackupReminder]);
  const duplicateTastingAsVintageWrapped = useCallback(async (t: Tasting) => { const id = await duplicateTastingAsVintage(t); checkBackupReminder(); return id; }, [duplicateTastingAsVintage, checkBackupReminder]);
  const updateCategoriesWrapped = useCallback(async (c: Category[]) => { await updateCategories(c); checkBackupReminder(); }, [updateCategories, checkBackupReminder]);
  const updateTagsWrapped = useCallback(async (o: string, n: string | null) => { await updateTags(o, n); checkBackupReminder(); }, [updateTags, checkBackupReminder]);
  const toggleFavoriteWrapped = useCallback(async (t: Tasting) => { await toggleFavorite(t); checkBackupReminder(); }, [toggleFavorite, checkBackupReminder]);
  const renameProducerWrapped = useCallback(async (o: string, n: string) => { await renameProducer(o, n); checkBackupReminder(); }, [renameProducer, checkBackupReminder]);

  // --- Settings Logic ---
  const applyAccentColor = useCallback((hex: string) => {
      setAccentColorState(hex);
      document.documentElement.style.setProperty('--color-primary-500', hex);
      let darker = hex; 
      if(hex === '#3b82f6') darker = '#2563eb';
      else if(hex === '#a855f7') darker = '#9333ea';
      else if(hex === '#10b981') darker = '#059669';
      else if(hex === '#f59e0b') darker = '#d97706';
      else if(hex === '#f43f5e') darker = '#e11d48';
      document.documentElement.style.setProperty('--color-primary-600', darker);
  }, []);
  
  const toggleOledMode = useCallback(() => { vibrate(); setIsOledMode(prev => { localStorage.setItem('katalist_oled', String(!prev)); return !prev; }); }, []);
  
  const toggleLightMode = useCallback(() => { 
      vibrate(); 
      setIsLightMode(prev => { 
          const next = !prev;
          localStorage.setItem('katalist_light', String(next));
          if (next) document.documentElement.classList.remove('dark');
          else document.documentElement.classList.add('dark');
          return next;
      }); 
  }, []);

  const setCurrency = useCallback((c: string) => { vibrate(); setCurrencyState(c); localStorage.setItem('katalist_currency', c); }, []);
  const setAccentColor = useCallback((c: string) => { vibrate(); applyAccentColor(c); localStorage.setItem('katalist_accent', c); }, [applyAccentColor]);
  const setScoreScale = useCallback((s: ScoreScaleType) => { vibrate(); setScoreScaleState(s); localStorage.setItem('katalist_scale', s); }, []);

  // --- Helper Score Formatter ---
  const formatScore = useCallback((score: number) => {
      if (scoreScale === '100') return Math.round(score * 10).toString();
      if (scoreScale === '5') return (score / 2).toFixed(1);
      return score.toString();
  }, [scoreScale]);

  // --- Deletion Logic ---
  const confirmDelete = useCallback((id: string) => { vibrate(); setIdToDelete(id); setDeleteModalOpen(true); }, []);
  const performDelete = useCallback(async () => { if (idToDelete) { await deleteTastingWrapped(idToDelete); setDeleteModalOpen(false); setIdToDelete(null); } }, [idToDelete, deleteTastingWrapped]);
  const removeToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // --- Derived State (Gamification & Tags) ---
  const prevLevelRef = useRef(1);
  const userProfile = useMemo(() => {
      if (isInitializing) return { level: 1, title: 'Curioso', xp: 0, nextLevelXp: 500, badges: [] };
      const profile = getUserProfile(tastings);
      if (profile.level > prevLevelRef.current) {
          setShowConfetti(true);
          setTimeout(() => showToast(`¡Nivel Subido! Ahora eres ${profile.title}`, 'success'), 100);
          setTimeout(() => setShowConfetti(false), 5000);
      }
      prevLevelRef.current = profile.level;
      return profile;
  }, [tastings, isInitializing, showToast]);

  const allTags = useMemo(() => {
      return Array.from(new Set(tastings.flatMap(t => t.tags)));
  }, [tastings]);


  // --- Context Composition ---
  const contextValue = useMemo(() => ({
      tastings, categories, userLists, selectedTasting, compareList,
      view, isInitializing, isOledMode, isLightMode, currency, accentColor, scoreScale,
      userProfile, showConfetti,
      isCloudConnected, cloudLastSync,
      installPrompt,
      
      setView: setViewWrapper,
      setSelectedTasting,
      toggleOledMode, toggleLightMode, setCurrency, setAccentColor, setScoreScale,
      installApp,
      
      refreshData,
      saveTasting: saveTastingWrapped,
      deleteTasting: deleteTastingWrapped,
      duplicateTasting: duplicateTastingWrapped,
      duplicateTastingAsVintage: duplicateTastingAsVintageWrapped,
      toggleFavorite: toggleFavoriteWrapped,
      updateStock,
      updateCategories: updateCategoriesWrapped,
      updateTags: updateTagsWrapped,
      renameProducer: renameProducerWrapped,
      optimizeTagsBulk,
      mergeTastings,
      
      createList, deleteList, addItemsToList, deleteTastingsBulk,
      
      importData, exportData, exportCSV,
      
      showToast, confirmDelete, toggleCompare, clearCompare,
      
      connectCloud, uploadToCloud, downloadFromCloud,
      
      formatScore, allTags
  }), [
      tastings, categories, userLists, selectedTasting, compareList,
      view, isInitializing, isOledMode, isLightMode, currency, accentColor, scoreScale,
      userProfile, showConfetti, isCloudConnected, cloudLastSync, installPrompt,
      setViewWrapper, showToast, saveTastingWrapped, deleteTastingWrapped, duplicateTastingWrapped, 
      duplicateTastingAsVintageWrapped, toggleFavoriteWrapped, updateStock, updateCategoriesWrapped, 
      updateTagsWrapped, renameProducerWrapped, optimizeTagsBulk, mergeTastings, createList, deleteList, 
      addItemsToList, deleteTastingsBulk, importData, exportData, exportCSV, confirmDelete, toggleCompare, 
      clearCompare, connectCloud, uploadToCloud, downloadFromCloud, setSelectedTasting, refreshData, toggleOledMode, toggleLightMode, setCurrency, setAccentColor, setScoreScale, installApp, formatScore, allTags
  ]);

  return (
    <KataContext.Provider value={contextValue}>
      {children}
      {showConfetti && <Confetti />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmModal isOpen={deleteModalOpen} title="Eliminar Cata" message="¿Estás seguro?" onConfirm={performDelete} onCancel={() => setDeleteModalOpen(false)} />
    </KataContext.Provider>
  );
};
