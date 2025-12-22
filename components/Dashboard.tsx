
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
  const { tastings, setView, setSelectedTasting, categories, toggleOledMode, isOledMode, toggleLightMode, isLightMode, exportData, importData, exportCSV, currency, setCurrency, accentColor, setAccentColor, userProfile, isCloudConnected, cloudLastSync, connectCloud, uploadToCloud, downloadFromCloud, showToast, scoreScale, setScoreScale, installPrompt, installApp } = useKataContext();
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
                <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-primary-500 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700/50 font-mono">v22.02</span>
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
                  <span className="text-[10px] text-purple-400 dark:text-indigo-200/70">Entrenamiento</span>
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

      {/* Settings Modal */}
      {settingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSettingsOpen(false)}>
              <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-dark-800 rounded-t-2xl">
                      <h3 className="text-xl font-serif font-bold text-slate-900 dark:text-white">Configuración</h3>
                      <button onClick={() => setSettingsOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition"><Icon name="close" className="text-slate-400" /></button>
                  </div>
                  <div className="overflow-y-auto p-4 space-y-4 scrollbar-hide">
                    {installPrompt && (
                        <button onClick={() => { installApp(); setSettingsOpen(false); }} className="w-full py-3 mb-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 animate-bounce-in active:scale-95 transition">
                            <Icon name="download" /> Instalar Aplicación
                        </button>
                    )}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Herramientas Extra</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => { setSettingsOpen(false); setView('MAP'); }} className="p-3 bg-slate-100 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600/50 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-300 flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-600 transition"><Icon name="public" /> Mapa</button>
                            <button onClick={() => { setSettingsOpen(false); setView('MERGE'); }} className="p-3 bg-slate-100 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600/50 rounded-xl text-xs font-bold text-yellow-600 dark:text-yellow-300 flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-600 transition"><Icon name="merge" /> Fusión</button>
                        </div>
                    </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
});
