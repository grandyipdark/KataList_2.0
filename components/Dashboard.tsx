
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKataContext, ScoreScaleType } from '../context/KataContext';
import { Icon, NeonWineIcon, SeasonalBackground, ConfirmModal } from './Shared';
import { getCountryFlag, getCategoryColor, getPriceVal, getDrinkingStatus } from '../utils/helpers';
import { TIPS } from '../utils/tipsData';
import { driveService } from '../services/driveService';

const useCountUp = (end: number, duration: number = 1500) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let startTime: number;
        let animationFrame: number;
        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4);
            setCount(Math.floor(ease * end));
            if (progress < 1) animationFrame = window.requestAnimationFrame(step);
        };
        animationFrame = window.requestAnimationFrame(step);
        return () => window.cancelAnimationFrame(animationFrame);
    }, [end, duration]);
    return count;
};

export const Dashboard = React.memo(() => {
  const { tastings, setView, setSelectedTasting, categories, toggleOledMode, isOledMode, toggleLightMode, isLightMode, exportData, importData, exportCSV, currency, setCurrency, accentColor, setAccentColor, userProfile, isCloudConnected, cloudLastSync, connectCloud, uploadToCloud, downloadFromCloud, isSyncing, showToast, scoreScale, setScoreScale, installPrompt, installApp } = useKataContext();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [dailyTip, setDailyTip] = useState(TIPS[0]);
  const [showCloudDev, setShowCloudDev] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(driveService.getClientId());
  
  // Conflicto de sincronización
  const [syncConflict, setSyncConflict] = useState<{remote: number, local: number} | null>(null);

  useEffect(() => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const diff = now.getTime() - start.getTime();
      const oneDay = 1000 * 60 * 60 * 24;
      const dayOfYear = Math.floor(diff / oneDay);
      const seed = dayOfYear + now.getFullYear(); 
      setDailyTip(TIPS[seed % TIPS.length]);
  }, []);

  const stats = useMemo(() => {
    const totalStock = tastings.reduce((acc, t) => acc + (t.stock || 0), 0);
    const portfolioValue = tastings.reduce((acc, t) => acc + (getPriceVal(t.price) * (t.stock || 0)), 0);
    return { portfolioValue, totalStock };
  }, [tastings]);

  const animatedStock = useCountUp(stats.totalStock);
  const animatedValue = useCountUp(stats.portfolioValue);
  const animatedTotal = useCountUp(tastings.length);

  const handleUpload = async (force: boolean = false) => {
      const result = await uploadToCloud(force);
      if (result?.conflict) {
          setSyncConflict({ remote: result.remoteCount, local: result.localCount });
      } else {
          setSyncConflict(null);
      }
  };

  const handleSmartSync = async () => {
      setSyncConflict(null);
      showToast("Fusionando datos...", "info");
      await downloadFromCloud(); // Descarga y une
      await uploadToCloud(true); // Sube el resultado final
  };

  const handleCopyOrigin = () => {
      navigator.clipboard.writeText(window.location.origin);
      showToast("URL Copiada", 'success');
  };

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
      <SeasonalBackground />
      
      {/* MODAL DE CONFLICTO */}
      <ConfirmModal 
        isOpen={!!syncConflict} 
        title="⚠️ Conflicto de Respaldo" 
        message={`El archivo en Drive tiene ${syncConflict?.remote} registros, pero tú solo tienes ${syncConflict?.local}. Si subes ahora, podrías perder datos.`}
        onConfirm={handleSmartSync} // Opción recomendada: Unir y subir
        onCancel={() => setSyncConflict(null)}
      >
          <div className="mt-4 space-y-2">
              <button onClick={() => handleUpload(true)} className="w-full py-2 text-[10px] text-red-400 font-bold border border-red-900/30 rounded-lg hover:bg-red-900/10">Sobreescribir de todos modos</button>
              <p className="text-[9px] text-slate-500 text-center italic">Confirmar hará una "Fusión Inteligente" (Une PC + Móvil)</p>
          </div>
      </ConfirmModal>

      <div className="flex justify-between items-center pt-4 pb-1 relative z-10">
        <div>
            <div className="flex items-center gap-3 mb-1">
                <div className="relative"><div className="absolute inset-0 bg-primary-500/20 blur-lg rounded-full"></div><NeonWineIcon className="w-8 h-8 relative z-10" /></div>
                <h1 className="text-3xl font-serif font-bold italic text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:via-primary-100 dark:to-slate-400">KataList</h1>
            </div>
            <div className="flex items-center gap-2 pl-1">
                <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-primary-500 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700/50">v22.06</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase opacity-80">Diario & Bodega</p>
            </div>
        </div>
        <button onClick={() => setSettingsOpen(true)} className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center text-slate-500 dark:text-slate-300 shadow-lg backdrop-blur-md">
            <Icon name="settings" className="text-xl" />
        </button>
      </div>

      {/* Profile Card */}
      <div onClick={() => setView('PROFILE')} className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 rounded-2xl border border-primary-500/30 shadow-lg relative overflow-hidden cursor-pointer group z-10">
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

      {/* Tip Section */}
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

      <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col justify-between relative overflow-hidden group shadow-lg">
              <div className="absolute -right-2 -top-2 p-3 opacity-5 group-hover:opacity-10 transition transform rotate-12"><Icon name="history_edu" className="text-6xl text-slate-900 dark:text-white" /></div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider z-10 flex items-center gap-1"><Icon name="history" className="text-xs" /> Histórico</span>
              <div className="flex items-baseline gap-1 z-10 mt-2">
                  <span className="text-3xl font-serif font-bold text-slate-900 dark:text-white tracking-tight">{animatedTotal}</span>
                  <span className="text-[10px] text-slate-500 font-bold mb-1">catas</span>
              </div>
          </div>

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

      <div className="grid grid-cols-2 gap-3 relative z-10">
          <button onClick={() => { setSelectedTasting(null); navigate('/new'); }} className="p-4 bg-primary-600 rounded-xl text-white shadow-lg shadow-blue-900/20 flex items-center gap-3 hover:bg-primary-500 transition active:scale-95 border border-primary-500">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Icon name="add" className="text-xl" /></div>
              <div className="text-left leading-tight"><span className="block font-bold text-sm">Cata Rápida</span><span className="text-[10px] opacity-80">Registro manual</span></div>
          </button>
          <button onClick={() => setView('GUIDED')} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-purple-600 dark:text-purple-400 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition active:scale-95 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-slate-900 flex items-center justify-center"><Icon name="psychology" className="text-xl" /></div>
              <div className="text-left leading-tight"><span className="block font-bold text-sm text-slate-900 dark:text-white">Cata Guiada</span><span className="text-[10px] text-slate-500">Asistente IA</span></div>
          </button>
      </div>

      {settingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSettingsOpen(false)}>
              <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
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
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Sincronización Nube</h4>
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-200 dark:border-blue-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Icon name="cloud" className="text-blue-500 dark:text-blue-400" />
                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-100">Google Drive</span>
                                    {isSyncing !== 'idle' && <Icon name="sync" className="text-blue-500 animate-spin text-sm" />}
                                </div>
                                <button onClick={() => setShowCloudDev(!showCloudDev)} className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded border border-blue-500 font-bold uppercase shadow-sm">Diagnóstico</button>
                            </div>
                            
                            {showCloudDev && (
                                <div className="bg-white dark:bg-slate-900/80 p-3 rounded-lg border border-blue-300 dark:border-blue-700 mb-3 animate-slide-up shadow-inner">
                                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-300 mb-2 flex items-center gap-1"><Icon name="report" className="text-xs" /> Solución de Errores:</p>
                                    <div className="space-y-4">
                                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                                            <p className="text-[9px] text-purple-800 dark:text-purple-200 mb-2 font-bold">🟣 Error: API_DRIVE_DISABLED</p>
                                            <button onClick={() => window.open('https://console.cloud.google.com/apis/library/drive.googleapis.com', '_blank')} className="w-full py-1.5 bg-purple-600 text-white rounded text-[9px] font-bold mb-1">1. Activar Google Drive API</button>
                                        </div>
                                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                                            <p className="text-[9px] text-red-800 dark:text-red-200 mb-2 font-bold">🔴 Error 403: access_denied</p>
                                            <button onClick={() => window.open('https://console.cloud.google.com/auth/user-list', '_blank')} className="w-full py-1.5 bg-red-600 text-white rounded text-[9px] font-bold mb-1">2. Abrir Lista de Usuarios</button>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1 font-bold">ID de Cliente:</p>
                                            <input value={clientIdInput} onChange={e => setClientIdInput(e.target.value)} className="w-full bg-slate-100 dark:bg-black p-2 rounded text-[10px] border border-slate-300 dark:border-slate-700 mb-2 text-white outline-none" />
                                            <button onClick={() => { driveService.setClientId(clientIdInput); showToast("Guardado", "success"); }} className="w-full py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold">Guardar ID</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!isCloudConnected ? (
                                <button onClick={connectCloud} disabled={isSyncing !== 'idle'} className={`w-full py-3 bg-white dark:bg-primary-500 text-primary-700 dark:text-white border border-primary-200 dark:border-transparent rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary-50 dark:hover:bg-primary-600 transition shadow-sm`}>
                                    <Icon name="login" className="text-sm" /> {isSyncing === 'connecting' ? 'Conectando...' : 'Conectar Google Drive'}
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400">
                                        <span>Último sync:</span>
                                        <span className="text-slate-700 dark:text-white font-mono">{cloudLastSync || 'Primera vez'}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleUpload(false)} disabled={isSyncing !== 'idle'} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-md">
                                            <Icon name={isSyncing === 'uploading' ? 'sync' : 'cloud_upload'} className={`text-sm ${isSyncing === 'uploading' ? 'animate-spin' : ''}`} /> Subir
                                        </button>
                                        <button onClick={downloadFromCloud} disabled={isSyncing !== 'idle'} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-md">
                                            <Icon name={isSyncing === 'downloading' ? 'sync' : 'cloud_download'} className={`text-sm ${isSyncing === 'downloading' ? 'animate-spin' : ''}`} /> Restaurar
                                        </button>
                                    </div>
                                    <button onClick={() => { driveService.logout(); window.location.reload(); }} className="w-full py-1.5 text-[10px] text-slate-400 hover:text-red-400 transition">Cerrar sesión de Drive</button>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* ... Resto de la configuración ... */}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
});
