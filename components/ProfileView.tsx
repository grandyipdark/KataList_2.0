
import React, { useState, useMemo } from 'react';
import { useKataContext } from '../context/KataContext';
import { Icon } from './Shared';
import { BadgeTier, Badge } from '../types';

export const ProfileView = React.memo(() => {
    const { userProfile, setView } = useKataContext();
    const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);

    const progressPercent = Math.min(100, (userProfile.xp / userProfile.nextLevelXp) * 100);

    const getTierColor = (tier: BadgeTier) => {
        if (tier === 'GOLD') return '#fbbf24'; // Amber-400
        if (tier === 'SILVER') return '#94a3b8'; // Slate-400
        if (tier === 'BRONZE') return '#d97706'; // Amber-600
        return '#334155'; // Slate-700
    };

    const getTierLabel = (tier: BadgeTier) => {
        if (tier === 'GOLD') return 'ORO';
        if (tier === 'SILVER') return 'PLATA';
        if (tier === 'BRONZE') return 'BRONCE';
        return '';
    };

    // Group badges by category
    const badgesByCategory = useMemo(() => {
        const groups: Record<string, Badge[]> = {};
        // Define order
        const order = ['🏆 General', '🍷 Estilos', '🌍 Exploración', '📝 Calidad', '👅 Perfil Sensorial', '💰 Valor', '📅 Hábitos', '🤖 Tecnología'];
        
        userProfile.badges.forEach(b => {
            const cat = b.category || 'Otros';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(b);
        });

        // Sort keys based on defined order
        return Object.entries(groups).sort((a, b) => {
            const idxA = order.indexOf(a[0]);
            const idxB = order.indexOf(b[0]);
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });
    }, [userProfile.badges]);

    return (
        <div className="flex flex-col h-full bg-dark-950 animate-fade-in">
            {/* Header Fixed */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-800 bg-dark-900/95 z-10 backdrop-blur shrink-0">
                <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 active:scale-95 transition-transform"><Icon name="arrow_back" /></button>
                <h2 className="font-bold text-white font-serif text-lg">Perfil de Sommelier</h2>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-24 space-y-6">
                {/* Compact Horizontal Header */}
                <div className="px-4 mt-4">
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 rounded-2xl border border-primary-500/30 shadow-lg relative overflow-hidden flex items-center gap-4">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Icon name="military_tech" className="text-6xl" /></div>
                        
                        <div className="relative flex-shrink-0">
                            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-primary-500 shadow-lg shadow-primary-500/20 flex items-center justify-center relative z-10">
                                <Icon name="military_tech" className="text-3xl text-primary-400" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-dark-900 z-20">
                                Lvl {userProfile.level}
                            </div>
                        </div>
                        
                        <div className="flex-1 min-w-0 relative z-10">
                            <h1 className="text-lg font-serif font-bold text-white truncate">{userProfile.title}</h1>
                            <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden mt-2 mb-1 border border-slate-600">
                                <div className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                <span>{userProfile.xp} XP</span>
                                <span>{userProfile.nextLevelXp} XP</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Badges Sections */}
                <div className="px-4 space-y-6">
                    {badgesByCategory.map(([category, badges]) => (
                        <div key={category} className="animate-slide-up">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-l-2 border-slate-600 pl-2 mb-3">
                                {category} <span className="text-slate-600">({badges.filter(b => b.tier !== 'LOCKED').length}/{badges.length})</span>
                            </h3>
                            
                            <div className="grid grid-cols-3 gap-2">
                                {badges.map(badge => {
                                    const isLocked = badge.tier === 'LOCKED';
                                    const tierColor = getTierColor(badge.tier);
                                    const progress = badge.nextThreshold ? Math.min(100, (badge.currentValue / badge.nextThreshold) * 100) : 100;
                                    const isSelected = selectedBadgeId === badge.id;
                                    
                                    return (
                                        <div 
                                            key={badge.id} 
                                            onClick={() => setSelectedBadgeId(isSelected ? null : badge.id)}
                                            className={`relative p-2 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer active:scale-95 ${isSelected ? 'bg-slate-700 border-primary-500 z-20 scale-105 shadow-xl ring-2 ring-primary-500/30' : isLocked ? 'bg-slate-900/40 border-slate-800 opacity-60 hover:opacity-80' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 transition-colors ${!isLocked ? 'bg-slate-900/50 shadow-inner' : 'bg-slate-800'}`} style={{ color: !isLocked ? badge.color : '#64748b' }}>
                                                <Icon name={badge.icon} className="text-lg" />
                                            </div>
                                            
                                            <h4 className={`font-bold text-[9px] leading-tight mb-1 line-clamp-2 h-[2.2em] flex items-center justify-center w-full ${!isLocked ? 'text-slate-200' : 'text-slate-600'}`}>
                                                {badge.name}
                                            </h4>
                                            
                                            {!isLocked ? (
                                                <span className="text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wide w-full" style={{ backgroundColor: `${tierColor}20`, color: tierColor }}>
                                                    {getTierLabel(badge.tier)}
                                                </span>
                                            ) : (
                                                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-0.5 overflow-hidden border border-slate-700/50">
                                                     <div className="h-full bg-slate-500" style={{ width: `${progress}%` }}></div>
                                                </div>
                                            )}

                                            {isSelected && (
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-[180%] min-w-[140px] bg-dark-900 border border-slate-500 p-2.5 rounded-xl shadow-2xl z-30 mt-2 pointer-events-none animate-slide-up">
                                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-dark-900 border-t border-l border-slate-500 transform rotate-45"></div>
                                                    <p className="text-[10px] text-white font-medium mb-2 leading-snug">{badge.description}</p>
                                                    <div className="flex justify-between text-[9px] text-slate-400 border-t border-slate-700 pt-1">
                                                        <span>Progreso:</span>
                                                        <span className="text-primary-400 font-bold">{badge.currentValue} / {badge.nextThreshold || 'MAX'}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Backdrop to close selection */}
            {selectedBadgeId && <div className="fixed inset-0 z-10" onClick={() => setSelectedBadgeId(null)}></div>}
        </div>
    );
});
