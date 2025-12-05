
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKataContext, ScoreScaleType } from '../context/KataContext';
import { Icon, NeonWineIcon, SeasonalBackground } from './Shared';
import { getCountryFlag, getCategoryColor, getPriceVal, getDrinkingStatus } from '../utils/helpers';
import { TIPS } from '../utils/tipsData';

// --- COUNT UP HOOK ---
const useCountUp = (end: number, duration: number = 1500) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
        let startTime: number;
        let animationFrame: number;
        
        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            
            // Ease out quart
            const ease = 1 - Math.pow(1 - progress, 4);
            
            setCount(Math.floor(ease * end));
            
            if (progress < 1) {
                animationFrame = window.requestAnimationFrame(step);
            }
        };
        
        animationFrame = window.requestAnimationFrame(step);
        return () => window.cancelAnimationFrame(animationFrame);
    }, [end, duration]);
    
    return count;
};

export const Dashboard = React.memo(() => {
  const { tastings, setView, setSelectedTasting, categories, toggleOledMode, isOledMode, toggleLightMode, isLightMode, exportData, importData, exportCSV, currency, setCurrency, accentColor, setAccentColor, userProfile, isCloudConnected, cloudLastSync, connectCloud, uploadToCloud, downloadFromCloud, showToast, scoreScale, setScoreScale } = useKataContext();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupTypeOpen, setBackupTypeOpen] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [dailyTip, setDailyTip] = useState(TIPS[0]);

  // Select random tip on mount based on Day of Year to ensure rotation through all 100 tips
  useEffect(() => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const diff = now.getTime() - start.getTime();
      const oneDay = 1000 * 60 * 60 * 24;
      const dayOfYear = Math.floor(diff / oneDay);
      
      // Use year as seed so order changes slightly every year
      const seed = dayOfYear + now.getFullYear(); 
      const index = seed % TIPS.length;
      
      setDailyTip(TIPS[index]);
  }, []);

  const stats = useMemo(() => {
    const totalStock = tastings.reduce((acc, t) => acc + (t.stock || 0), 0);
    const portfolioValue = tastings.reduce((acc, t) => {
        const p = getPriceVal(t.price);
        const s = t.stock || 0;
        return acc + (p * s);
    }, 0);

    return { portfolioValue, totalStock };
  }, [tastings]);

  // Animated Stats
  const animatedStock = useCountUp(stats.totalStock);
  const animatedValue = useCountUp(stats.portfolioValue);
  const animatedTotal = useCountUp(tastings.length);

  // --- ALERTS LOGIC ---
  const alerts = useMemo(() => {
      const openBottles = tastings.filter(t => t.openDate);
      const expiringSoon = tastings.filter(t => {
          if (t.stock === 0) return false;
          const status = getDrinkingStatus(t.drinkFrom, t.drinkTo);
          // Alert if PAST or if it's the last year of drinking window
          const currentYear = new Date().getFullYear();
          const toYear = t.drinkTo ? parseInt(t.drinkTo) : 9999;
          return status === 'PAST' || (toYear === currentYear);
      });
      return { openBottles, expiringSoon };
  }, [tastings]);

  const handleBackup = async (includeImages: boolean) => {
      setBackupTypeOpen(false);
      setSettingsOpen(false);
      const data = await exportData(includeImages);
      const blob = new Blob([data], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `katalist_backup_${includeImages ? 'full' : 'text'}.json`;
      a.click();
  };

  const handleCopyOrigin = () => {
      navigator.clipboard.writeText(window.location.origin);
      showToast("URL copiada. Añádela a Google Cloud.", 'success');
  };

  const isDynamicDomain = window.location.hostname.includes('usercontent.goog') || 
                          window.location.hostname.includes('webcontainer') ||
                          window.location.hostname.includes('codesandbox');

  const themes = [
      { name: 'Azul', color: '#3b82f6' },
      { name: 'Púrpura', color: '#a855f7' },
      { name: 'Esmeralda', color: '#10b981' },
      { name: 'Ámbar', color: '#f59e0b' },
      { name: 'Rosa', color: '#f43f5e' }
  ];

  const progressPercent = Math.min(100, (userProfile.xp / userProfile.nextLevelXp) * 100);

  return (
    <div className="pb-24 space-y-5 animate-fade-in relative">
      {/* Seasonal Background Effect */}
      <SeasonalBackground />

      {/* Header Premium */}
      <div className="flex justify-between items-center pt-4 pb-1 relative z-10">
        <div>
            <div className="flex items-center gap-3 mb-1">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary-500/20 blur-lg rounded-full"></div>
                    <NeonWineIcon className="w-8 h-8 relative z-10" />
                </div>
                <h1 className="text-3xl font-serif font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:via-primary-100 dark:to-slate-400 drop-shadow-sm">
                    KataList
                </h1>
            </div>
            <div className="flex items-center gap-2 pl-1">
                <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-primary-500 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700/50 font-mono">v21.07</span>
                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase opacity-80">Diario & Bodega</p>
            </div>
        </div>
        <button onClick={() => setSettingsOpen(true)} className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-primary-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all shadow-lg backdrop-blur-md">
            <Icon name="settings" className="text-xl" />
        </button>
      </div>

      {/* Gamification Profile Card */}
      <div onClick={() => setView('PROFILE')} className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 rounded-2xl border border-slate-700/50 shadow-lg relative overflow-hidden cursor-pointer group active:scale-[0.99] transition z-10">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><Icon name="military_tech" className="text-6xl text-white" /></div>
          <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-primary-500 flex items-center justify-center shadow-lg shadow-primary-900/30">
                  <span className="font-serif font-bold text-lg text-primary-400">{userProfile.level}</span>
              </div>
              <div className="flex-1">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Nivel {userProfile.level}: {userProfile.title}</h3>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-primary-500 to-purple-500 h-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-medium">
                      <span>{userProfile.xp} XP</span>
                      <span>{userProfile.nextLevelXp} XP</span>
                  </div>
              </div>
              <Icon name="chevron_right" className="text-slate-500" />
          </div>
      </div>

      {/* Tasting School Widget */}
      <div className="bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex items-start gap-4 shadow-sm relative overflow-hidden z-10">
          <div className="absolute top-0 right-0 p-2 opacity-5"><Icon name="school" className="text-6xl text-slate-900 dark:text-white" /></div>
          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600 dark:text-yellow-500 flex-shrink-0 border border-yellow-500/20 overflow-hidden">
              <Icon name={dailyTip.icon} />
          </div>
          <div className="flex-1 relative z-10">
              <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Escuela de Cata</h4>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug font-medium italic">"{dailyTip.text}"</p>
          </div>
      </div>

      {/* STATS & CELLAR GRID (REDESIGNED) */}
      <div className="grid grid-cols-2 gap-3 relative z-10">
          {/* Total History Card */}
          <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col justify-between relative overflow-hidden group shadow-lg">
              <div className="absolute -right-2 -top-2 p-3 opacity-5 group-hover:opacity-10 transition transform rotate-12"><Icon name="history_edu" className="text-6xl text-slate-900 dark:text-white" /></div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider z-10 flex items-center gap-1"><Icon name="history" className="text-xs" /> Histórico</span>
              <div className="flex items-baseline gap-1 z-10 mt-2">
                  <span className="text-3xl font-serif font-bold text-slate-900 dark:text-white tracking-tight">{animatedTotal}</span>
                  <span className="text-[10px] text-slate-500 font-bold mb-1">catas</span>
              </div>
          </div>

          {/* Active Cellar Card */}
          <div className="bg-gradient-to-br from-slate-100 to-white dark:from-slate-800 dark:to-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col justify-between relative overflow-hidden group shadow-lg">
               <div className="absolute -right-2 -top-2 p-3 opacity-5 group-hover:opacity-10 transition transform rotate-12"><Icon name="kitchen" className="text-6xl text-primary-400" /></div>
               
               <div className="flex justify-between items-start z-10 w-full">
                  <span className="text-[10px] text-primary-600 dark:text-primary-400 font-bold uppercase tracking-wider flex items-center gap-1"><Icon name="inventory_2" className="text-xs" /> Bodega</span>
                  <button onClick={(e) => { e.stopPropagation(); setShowValue(!showValue); }} className="text-[9px] font-bold bg-white/50 dark:bg-black/30 px-2 py-0.5 rounded border border-slate-300 dark:border-white/10 hover:bg-white dark:hover:bg-black/50 transition text-emerald-600 dark:text-emerald-400">
                      {showValue ? 'Ocultar' : 'Valor $'}
                  </button>
               </div>

               <div className="flex flex-col z-10 mt-1">
                  <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-serif font-bold text-slate-900 dark:text-white tracking-tight">{animatedStock}</span>
                      <span className="text-[10px] text-slate-500 font-bold mb-1">botellas</span>
                  </div>
                  {showValue && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-fade-in mt-[-4px]">
                          ≈ {currency} {animatedValue.toLocaleString()}
                      </span>
                  )}
               </div>
          </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 relative z-10">
          <button onClick={() => { setSelectedTasting(null); setView('NEW'); }} className="p-4 bg-primary-600 rounded-xl text-white shadow-lg shadow-blue-900/20 flex items-center gap-3 hover:bg-primary-500 transition active:scale-95 border border-primary-500">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Icon name="add" className="text-xl" /></div>
              <div className="text-left leading-tight"><span className="block font-bold text-sm">Cata Rápida</span><span className="text-[10px] opacity-80">Registro manual</span></div>
          </button>
          <button onClick={() => setView('GUIDED')} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-purple-600 dark:text-purple-400 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition active:scale-95 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-slate-900 flex items-center justify-center"><Icon name="psychology" className="text-xl" /></div>
              <div className="text-left leading-tight"><span className="block font-bold text-sm text-slate-900 dark:text-white">Cata Guiada</span><span className="text-[10px] text-slate-500">Asistente IA</span></div>
          </button>
      </div>

      {/* Tools Grid - Styled to match Primary Actions */}
      <div className="grid grid-cols-2 gap-3 relative z-10">
          <button onClick={() => setView('INSIGHTS')} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-indigo-500/30 shadow flex items-center gap-3 active:scale-[0.99] transition hover:bg-slate-50 dark:hover:bg-slate-750">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                  <Icon name="monitoring" className="text-xl" />
              </div>
              <div className="text-left leading-tight">
                  <span className="block font-bold text-sm text-slate-900 dark:text-white">Insights</span>
                  <span className="text-[10px] text-indigo-400 dark:text-indigo-200/70">Estadísticas</span>
              </div>
          </button>

          <button onClick={() => setView('CHEF')} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-orange-500/30 shadow flex items-center gap-3 active:scale-[0.99] transition hover:bg-slate-50 dark:hover:bg-slate-750">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500 dark:text-orange-400">
                  <Icon name="chef_hat" className="text-xl" />
              </div>
              <div className="text-left leading-tight">
                  <span className="block font-bold text-sm text-slate-900 dark:text-white">Chef Mode</span>
                  <span className="text-[10px] text-orange-400 dark:text-orange-200/70">Maridaje</span>
              </div>
          </button>

          <button onClick={() => setView('MIXOLOGY')} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-pink-500/30 shadow flex items-center gap-3 active:scale-[0.99] transition hover:bg-slate-50 dark:hover:bg-slate-750">
              <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-500 dark:text-pink-400">
                  <Icon name="local_bar" className="text-xl" />
              </div>
              <div className="text-left leading-tight">
                  <span className="block font-bold text-sm text-slate-900 dark:text-white">Bartender</span>
                  <span className="text-[10px] text-pink-400 dark:text-pink-200/70">Cócteles</span>
              </div>
          </button>

          <button onClick={() => setView('BLIND')} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-purple-500/30 shadow flex items-center gap-3 active:scale-[0.99] transition hover:bg-slate-50 dark:hover:bg-slate-750">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-500 dark:text-purple-400">
                  <Icon name="visibility_off" className="text-xl" />
              </div>
              <div className="text-left leading-tight">
                  <span className="block font-bold text-sm text-slate-900 dark:text-white">A Ciegas</span>
                  <span className="text-[10px] text-purple-400 dark:text-purple-200/70">Entrenamiento</span>
              </div>
          </button>
      </div>

      {/* CONSUMPTION ALERTS WIDGET (MOVED & COMPACTED) */}
      {(alerts.openBottles.length > 0 || alerts.expiringSoon.length > 0) && (
          <div className="bg-gradient-to-r from-orange-100/50 to-red-100/50 dark:from-orange-900/20 dark:to-red-900/20 p-3 rounded-xl border border-orange-500/20 relative z-10 animate-slide-up">
              <h4 className="text-[10px] font-bold text-orange-600 dark:text-orange-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Icon name="notifications_active" className="text-xs animate-pulse" /> Alertas de Consumo
              </h4>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {alerts.openBottles.map(t => {
                      const daysOpen = Math.floor((Date.now() - t.openDate!) / (1000 * 60 * 60 * 24));
                      return (
                          <div key={t.id} onClick={() => { setSelectedTasting(t); navigate(`/tasting/${t.id}`); }} className="min-w-[110px] bg-white dark:bg-dark-900/90 p-2 rounded-lg border border-orange-500/20 cursor-pointer flex flex-col gap-0.5 active:scale-95 transition shadow-sm">
                              <span className="text-[9px] text-orange-500 dark:text-orange-400 font-bold flex items-center gap-1"><Icon name="timelapse" className="text-[10px]" /> {daysOpen}d abierto</span>
                              <span className="text-[10px] font-bold text-slate-800 dark:text-white truncate w-full">{t.name}</span>
                          </div>
                      );
                  })}
                  {alerts.expiringSoon.map(t => (
                      <div key={t.id} onClick={() => { setSelectedTasting(t); navigate(`/tasting/${t.id}`); }} className="min-w-[110px] bg-white dark:bg-dark-900/90 p-2 rounded-lg border border-red-500/20 cursor-pointer flex flex-col gap-0.5 active:scale-95 transition shadow-sm">
                          <span className="text-[9px] text-red-500 dark:text-red-400 font-bold flex items-center gap-1"><Icon name="hourglass_bottom" className="text-[10px]" /> Beber Ya</span>
                          <span className="text-[10px] font-bold text-slate-800 dark:text-white truncate w-full">{t.name}</span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Settings Modal - Better Scrolling & Layout */}
      {settingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSettingsOpen(false)}>
              <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  {/* Fixed Header */}
                  <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-dark-800 rounded-t-2xl">
                      <h3 className="text-xl font-serif font-bold text-slate-900 dark:text-white">Configuración</h3>
                      <button onClick={() => setSettingsOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition"><Icon name="close" className="text-slate-400" /></button>
                  </div>
                  
                  {/* Scrollable Content */}
                  <div className="overflow-y-auto p-4 space-y-4 scrollbar-hide">

                    {/* 1. HERRAMIENTAS */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Herramientas Extra</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => { setSettingsOpen(false); setView('MAP'); }} className="p-3 bg-slate-100 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600/50 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-300 flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-600 transition"><Icon name="public" /> Mapa</button>
                            <button onClick={() => { setSettingsOpen(false); setView('MERGE'); }} className="p-3 bg-slate-100 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600/50 rounded-xl text-xs font-bold text-yellow-600 dark:text-yellow-300 flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-600 transition"><Icon name="merge" /> Fusión</button>
                        </div>
                    </div>

                    {/* 2. NUBE */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Sincronización Nube</h4>
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-200 dark:border-blue-500/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Icon name="cloud" className="text-blue-500 dark:text-blue-400" />
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-100">Google Drive</span>
                            </div>
                            
                            {/* OAuth Diagnostic */}
                            <div className={`p-2 rounded-lg mb-2 border ${isDynamicDomain ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-500/30' : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-500/30'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <p className={`text-[9px] font-bold flex items-center gap-1 ${isDynamicDomain ? 'text-red-700 dark:text-red-200' : 'text-yellow-700 dark:text-yellow-200'}`}>
                                        <Icon name={isDynamicDomain ? "error" : "warning"} className="text-[10px]" /> 
                                        {isDynamicDomain ? 'Dominio No Soportado' : 'Configurar Google Cloud:'}
                                    </p>
                                    <button onClick={handleCopyOrigin} className={`text-[9px] px-2 py-0.5 rounded border font-bold ${isDynamicDomain ? 'bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/40 text-red-700 dark:text-red-200 border-red-200 dark:border-red-500/30' : 'bg-yellow-100 dark:bg-yellow-500/20 hover:bg-yellow-200 dark:hover:bg-yellow-500/40 text-yellow-700 dark:text-yellow-200 border-yellow-200 dark:border-yellow-500/30'}`}>Copiar</button>
                                </div>
                                <code className="block bg-black/5 dark:bg-black/50 p-1.5 rounded text-[9px] text-slate-600 dark:text-yellow-100 break-all font-mono select-all">
                                    {window.location.origin}
                                </code>
                            </div>

                            {!isCloudConnected ? (
                                <button onClick={connectCloud} disabled={isDynamicDomain} className={`w-full py-2 bg-white dark:bg-white text-dark-900 border border-slate-200 dark:border-transparent rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-200 transition ${isDynamicDomain ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <Icon name="login" className="text-sm" /> Conectar
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400">
                                        <span>Último sync:</span>
                                        <span className="text-slate-700 dark:text-white">{cloudLastSync || 'Nunca'}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={uploadToCloud} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                                            <Icon name="cloud_upload" className="text-sm" /> Subir
                                        </button>
                                        <button onClick={downloadFromCloud} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                                            <Icon name="cloud_download" className="text-sm" /> Restaurar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. APARIENCIA */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Apariencia</h4>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                            {/* Colors */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-600 dark:text-slate-400">Acento</span>
                                <div className="flex gap-2">
                                    {themes.map(t => (
                                        <button key={t.name} onClick={() => setAccentColor(t.color)} className={`w-6 h-6 rounded-full border-2 transition ${accentColor === t.color ? 'border-slate-400 dark:border-white scale-110 shadow-lg' : 'border-transparent opacity-70'}`} style={{ backgroundColor: t.color }} title={t.name}></button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="h-px bg-slate-200 dark:bg-slate-800 w-full"></div>

                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-600 dark:text-slate-400">Modo Claro / Oscuro</span>
                                <button onClick={toggleLightMode} className="w-10 h-5 bg-slate-300 dark:bg-slate-700 rounded-full relative transition-colors"><div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all bg-white shadow-sm ${!isLightMode ? 'left-5' : 'left-0.5'}`}></div></button>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-600 dark:text-slate-400">Negro Puro (OLED)</span>
                                <button onClick={toggleOledMode} className="w-10 h-5 bg-slate-300 dark:bg-slate-700 rounded-full relative transition-colors"><div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${isOledMode ? 'left-5 bg-white' : 'left-0.5 bg-slate-400'}`}></div></button>
                            </div>

                            <div className="h-px bg-slate-200 dark:bg-slate-800 w-full"></div>

                            {/* Currency */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-600 dark:text-slate-400">Moneda</span>
                                <div className="flex gap-1">
                                    {['$', '€', '£', '¥'].map(c => ( <button key={c} onClick={() => setCurrency(c)} className={`w-8 h-6 rounded font-bold text-xs ${currency === c ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent'}`}>{c}</button> ))}
                                </div>
                            </div>

                            <div className="h-px bg-slate-200 dark:bg-slate-800 w-full"></div>

                            {/* Score Scale */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-600 dark:text-slate-400">Escala</span>
                                <div className="flex gap-1">
                                    {[
                                        { l: '10', v: '10' }, 
                                        { l: '100', v: '100' }, 
                                        { l: '★★', v: '5' }
                                    ].map(s => (
                                        <button 
                                            key={s.v} 
                                            onClick={() => setScoreScale(s.v as ScoreScaleType)} 
                                            className={`px-2 py-1 rounded font-bold text-[10px] ${scoreScale === s.v ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent'}`}
                                        >
                                            {s.l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. DATOS */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Gestión de Datos</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                                <button onClick={() => setBackupTypeOpen(!backupTypeOpen)} className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700"><Icon name="download" /> Respaldo</button>
                                {backupTypeOpen && ( <div className="absolute bottom-full left-0 w-full mb-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-xl animate-slide-up z-20"><button onClick={() => handleBackup(true)} className="w-full text-left p-2 text-xs text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Completo</button><button onClick={() => handleBackup(false)} className="w-full text-left p-2 text-xs text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Solo Texto</button></div> )}
                            </div>
                            <button onClick={exportCSV} className="w-full py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30 rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-green-100 dark:hover:bg-green-900/30"><Icon name="table_view" /> CSV</button>
                            <label className="col-span-2 w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-xs flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"><Icon name="upload_file" /> Importar Backup JSON<input type="file" hidden accept=".json" onChange={(e) => { if(e.target.files?.[0]) { const r = new FileReader(); r.onload = (ev) => { importData(ev.target?.result as string); setSettingsOpen(false); }; r.readAsText(e.target.files[0]); } }} /></label>
                        </div>
                    </div>

                  </div>
              </div>
          </div>
      )}
    </div>
  );
});