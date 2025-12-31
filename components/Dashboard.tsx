
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
      if (result?.conflict) setSyncConflict({ remote: result.remoteCount, local: result.localCount });
      else setSyncConflict(null);
  };

  const handleSmartSync = async () => {
      setSyncConflict(null);
      showToast("Fusionando datos...", "info");
      await downloadFromCloud(); 
      await uploadToCloud(true); 
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
      <ConfirmModal isOpen={!!syncConflict} title="⚠️ Conflicto de Respaldo" message={`El archivo en Drive tiene ${syncConflict?.remote} registros, pero tú tienes ${syncConflict?.local}. ¿Deseas fusionar PC + Móvil?`} onConfirm={handleSmartSync} onCancel={() => setSyncConflict(null)}>
          <div className="mt-4 space-y-2"><button onClick={() => handleUpload(true)} className="w-full py-2 text-[10px] text-red-400 font-bold border border-red-900/30 rounded-lg">Sobreescribir de todos modos</button></div>
      </ConfirmModal>

      <div className="flex justify-between items-center pt-4 pb-1 relative z-10">
        <div>
            <div className="flex items-center gap-3 mb-1"><div className="relative"><div className="absolute inset-0 bg-primary-500/20 blur-lg rounded-full"></div><NeonWineIcon className="w-8 h-8 relative z-10" /></div><h1 className="text-3xl font-serif font-bold italic text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:via-primary-100 dark:to-slate-400">KataList</h1></div>
            <div className="flex items-center gap-2 pl-1"><span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-primary-500 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700/50">v22.07</span><p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase opacity-80">Diario & Bodega</p></div>
        </div>
        <button onClick={() => setSettingsOpen(true)} className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center text-slate-500 dark:text-slate-300 shadow-lg backdrop-blur-md transition-all active:scale-95"><Icon name="settings" className="text-xl" /></button>
      </div>

      <div onClick={() => navigate('/profile')} className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 rounded-2xl border border-primary-500/30 shadow-lg relative overflow-hidden cursor-pointer group z-10">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><Icon name="military_tech" className="text-6xl text-white" /></div>
          <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-primary-500 flex items-center justify-center shadow-lg shadow-primary-900/30"><span className="font-serif font-bold text-lg text-primary-400">{userProfile.level}</span></div>
              <div className="flex-1">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Nivel {userProfile.level}: {userProfile.title}</h3>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-gradient-to-r from-primary-500 to-purple-500 h-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div></div>
                  <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-medium"><span>{userProfile.xp} XP</span><span>{userProfile.nextLevelXp} XP</span></div>
              </div>
              <Icon name="chevron_right" className="text-slate-500" />
          </div>
      </div>

      <div className="bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex items-start gap-4 shadow-sm relative overflow-hidden z-10">
          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600 dark:text-yellow-500 flex-shrink-0 border border-yellow-500/20"><Icon name={dailyTip.icon} /></div>
          <div className="flex-1 relative z-10"><h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Escuela de Cata</h4><p className="text-sm text-slate-700 dark:text-slate-200 leading-snug font-medium italic">"{dailyTip.text}"</p></div>
      </div>

      <div className="grid grid-cols-2 gap-3 relative z-10">
          <div onClick={() => navigate('/search')} className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col justify-between relative overflow-hidden group shadow-lg cursor-pointer">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider z-10 flex items-center gap-1"><Icon name="history" className="text-xs" /> Histórico</span>
              <div className="flex items-baseline gap-1 z-10 mt-2"><span className="text-3xl font-serif font-bold text-slate-900 dark:text-white tracking-tight">{animatedTotal}</span><span className="text-[10px] text-slate-500 font-bold mb-1">catas</span></div>
          </div>
          <div onClick={() => setShowValue(!showValue)} className="bg-gradient-to-br from-slate-100 to-white dark:from-slate-800 dark:to-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col justify-between relative overflow-hidden group shadow-lg cursor-pointer">
               <div className="flex justify-between items-start z-10 w-full"><span className="text-[10px] text-primary-600 dark:text-primary-400 font-bold uppercase tracking-wider flex items-center gap-1"><Icon name="inventory_2" className="text-xs" /> Bodega</span></div>
               <div className="flex flex-col z-10 mt-1"><div className="flex items-baseline gap-1"><span className="text-3xl font-serif font-bold text-slate-900 dark:text-white tracking-tight">{animatedStock}</span><span className="text-[10px] text-slate-500 font-bold mb-1">items</span></div>{showValue && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-fade-in mt-[-4px]">≈ {currency} {animatedValue.toLocaleString()}</span>}</div>
          </div>
      </div>

      <div className="grid grid-cols-2 gap-3 relative z-10">
          <button onClick={() => navigate('/new')} className="p-4 bg-primary-600 rounded-xl text-white shadow-lg flex items-center gap-3 active:scale-95 transition border border-primary-500"><div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Icon name="add" className="text-xl" /></div><div className="text-left leading-tight"><span className="block font-bold text-sm">Cata Rápida</span><span className="text-[10px] opacity-80">Manual</span></div></button>
          <button onClick={() => navigate('/guided')} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-purple-600 dark:text-purple-400 flex items-center gap-3 active:scale-95 shadow-sm"><div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-slate-900 flex items-center justify-center"><Icon name="psychology" className="text-xl" /></div><div className="text-left leading-tight"><span className="block font-bold text-sm text-slate-900 dark:text-white">Cata Guiada</span><span className="text-[10px] text-slate-500">IA</span></div></button>
      </div>

      <div className="grid grid-cols-4 gap-2 relative z-10">
          {[
              { id: 'insights', icon: 'bar_chart', label: 'Insights', path: '/insights', color: 'text-blue-400' },
              { id: 'chef', icon: 'restaurant_menu', label: 'Chef', path: '/chef', color: 'text-orange-400' },
              { id: 'map', icon: 'public', label: 'Mapa', path: '/map', color: 'text-green-400' },
              { id: 'merge', icon: 'merge', label: 'Fusión', path: '/merge', color: 'text-purple-400' }
          ].map(tool => (
              <button key={tool.id} onClick={() => navigate(tool.path)} className="bg-white dark:bg-dark-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700/50 flex flex-col items-center gap-1 active:scale-95 transition shadow-sm">
                  <Icon name={tool.icon} className={tool.color} />
                  <span className="text-[9px] font-bold text-slate-500 uppercase">{tool.label}</span>
              </button>
          ))}
      </div>

      {settingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSettingsOpen(false)}>
              <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                      <h3 className="text-xl font-serif font-bold text-slate-900 dark:text-white">Configuración</h3>
                      <button onClick={() => setSettingsOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition"><Icon name="close" className="text-slate-400" /></button>
                  </div>
                  <div className="overflow-y-auto p-4 space-y-6 scrollbar-hide">
                    {installPrompt && ( <button onClick={() => { installApp(); setSettingsOpen(false); }} className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 active:scale-95 transition"><Icon name="download" /> Instalar Aplicación</button> )}
                    
                    <section>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Respaldo Nube</h4>
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-200 dark:border-blue-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2"><Icon name="cloud" className="text-blue-500" /><span className="text-xs font-bold text-blue-700 dark:text-blue-100">Google Drive</span>{isSyncing !== 'idle' && <Icon name="sync" className="text-blue-500 animate-spin text-sm" />}</div>
                                <button onClick={() => setShowCloudDev(!showCloudDev)} className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded border border-blue-500 font-bold uppercase">Diagnóstico</button>
                            </div>
                            {showCloudDev && (
                                <div className="bg-white dark:bg-slate-900/80 p-3 rounded-lg border border-blue-300 dark:border-blue-700 mb-3 animate-slide-up">
                                    <p className="text-[10px] text-blue-600 dark:text-blue-300 mb-2 font-bold">Ajustes Avanzados:</p>
                                    <input value={clientIdInput} onChange={e => setClientIdInput(e.target.value)} placeholder="Google Client ID" className="w-full bg-slate-100 dark:bg-black p-2 rounded text-[10px] border border-slate-300 dark:border-slate-700 mb-2 text-white outline-none" />
                                    <button onClick={() => { driveService.setClientId(clientIdInput); showToast("ID Guardado", "success"); }} className="w-full py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold">Guardar ID</button>
                                </div>
                            )}
                            {!isCloudConnected ? (
                                <button onClick={connectCloud} disabled={isSyncing !== 'idle'} className="w-full py-3 bg-white dark:bg-primary-500 text-primary-700 dark:text-white border border-primary-200 dark:border-transparent rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"><Icon name="login" className="text-sm" /> Conectar Drive</button>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400"><span>Último sync:</span><span className="font-mono">{cloudLastSync || 'Pendiente'}</span></div>
                                    <div className="flex gap-2"><button onClick={() => handleUpload(false)} disabled={isSyncing !== 'idle'} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-md"><Icon name="cloud_upload" className="text-sm" /> Subir</button><button onClick={downloadFromCloud} disabled={isSyncing !== 'idle'} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-md"><Icon name="cloud_download" className="text-sm" /> Restaurar</button></div>
                                    <button onClick={() => { driveService.logout(); window.location.reload(); }} className="w-full py-1.5 text-[9px] text-slate-400 hover:text-red-400">Cerrar Sesión</button>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Personalización</h4>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Moneda</span>
                                <input value={currency} onChange={e => setCurrency(e.target.value)} className="w-12 bg-white dark:bg-slate-800 text-center text-xs font-bold py-1 rounded border border-slate-300 dark:border-slate-700 text-white" />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Escala de Nota</span>
                                <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
                                    <button onClick={() => setScoreScale('10')} className={`px-2 py-1 text-[10px] font-bold rounded ${scoreScale === '10' ? 'bg-primary-500 text-white' : 'text-slate-500'}`}>0-10</button>
                                    <button onClick={() => setScoreScale('100')} className={`px-2 py-1 text-[10px] font-bold rounded ${scoreScale === '100' ? 'bg-primary-500 text-white' : 'text-slate-500'}`}>0-100</button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Modo OLED</span>
                                <button onClick={toggleOledMode} className={`w-10 h-5 rounded-full relative transition-colors ${isOledMode ? 'bg-green-500' : 'bg-slate-400'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${isOledMode ? 'left-5.5' : 'left-0.5'}`}></div></button>
                            </div>
                            <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Color de Acento</span>
                                <div className="flex gap-2">{themes.map(t => ( <button key={t.color} onClick={() => setAccentColor(t.color)} className={`w-6 h-6 rounded-full border-2 ${accentColor === t.color ? 'border-white ring-2 ring-primary-500' : 'border-transparent'}`} style={{ backgroundColor: t.color }} /> ))}</div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Datos Externos</h4>
                        <div className="flex gap-2">
                            <button onClick={async () => { const json = await exportData(); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `katalist_backup_${Date.now()}.json`; a.click(); }} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white rounded-xl text-[10px] font-bold border border-slate-300 dark:border-slate-600 uppercase flex items-center justify-center gap-1"><Icon name="download" className="text-xs" /> Exportar JSON</button>
                            <button onClick={exportCSV} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white rounded-xl text-[10px] font-bold border border-slate-300 dark:border-slate-600 uppercase flex items-center justify-center gap-1"><Icon name="table_chart" className="text-xs" /> Exportar CSV</button>
                        </div>
                        <label className="block w-full py-3 bg-primary-900/20 text-primary-400 rounded-xl text-[10px] font-bold border border-primary-500/30 uppercase text-center cursor-pointer active:scale-95 transition-transform"><Icon name="upload" className="text-xs mr-1" /> Importar Archivo <input type="file" hidden accept=".json" onChange={async (e) => { if (e.target.files?.[0]) { const reader = new FileReader(); reader.onload = async (re) => { if (await importData(re.target?.result as string)) showToast("Importación exitosa", "success"); }; reader.readAsText(e.target.files[0]); } }} /></label>
                    </section>

                    <div className="pt-4 border-t border-slate-700 text-center opacity-30"><p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">Hecho con ❤️ para amantes de la cata</p></div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
});
