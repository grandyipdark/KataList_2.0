
import React, { useMemo, useState } from 'react';
import { useKataContext } from '../context/KataContext';
import { Icon, SimpleBarChart, SimpleDonutChart, RadarChart } from './Shared';
import { getPriceVal, getCountryFlag, getCategoryColor, getProfileLabels } from '../utils/helpers';
import { FlavorProfile } from '../types';

export const InsightsView = React.memo(() => {
    const { tastings, categories, setView, currency } = useKataContext();
    const [selectedProfileCat, setSelectedProfileCat] = useState<string | null>(null);

    const stats = useMemo(() => {
        const totalTastings = tastings.length;
        if (totalTastings === 0) return null;

        const validPriceCount = tastings.filter(t => getPriceVal(t.price) > 0).length;
        const avgPrice = validPriceCount ? tastings.reduce((acc, t) => acc + getPriceVal(t.price), 0) / validPriceCount : 0;

        // By Category
        const catStats: Record<string, { count: number, sumScore: number, sumPrice: number }> = {};
        // By Country
        const countryStats: Record<string, number> = {};
        // By Month (Last 6 months)
        const monthStats: Record<string, number> = {};
        const months: string[] = [];
        
        // --- NEW: Tags & Profile Stats ---
        const tagCounts: Record<string, number> = {};
        const varietyStats: Record<string, { count: number, totalScore: number }> = {};
        
        // --- CALCULATE PROFILES FOR ALL CATEGORIES ---
        // Store both Profile and Count of tastings used
        const categoryProfiles: Record<string, { profile: FlavorProfile, count: number }> = {};
        const uniqueCategoriesWithProfile = Array.from(new Set(tastings.filter(t => t.profile).map(t => t.category))) as string[];
        
        uniqueCategoriesWithProfile.forEach(cat => {
            // Try to find high rated first (Ideal Profile)
            let itemsToCalc = tastings.filter(t => t.category === cat && t.score >= 8 && t.profile);
            
            // Fallback: If no high rated items, use ALL items in category (Average Profile)
            if (itemsToCalc.length === 0) {
                itemsToCalc = tastings.filter(t => t.category === cat && t.profile);
            }

            if (itemsToCalc.length > 0) {
                 const sumP = itemsToCalc.reduce<FlavorProfile>((acc, t) => ({
                    p1: acc.p1 + (t.profile?.p1 || 0),
                    p2: acc.p2 + (t.profile?.p2 || 0),
                    p3: acc.p3 + (t.profile?.p3 || 0),
                    p4: acc.p4 + (t.profile?.p4 || 0),
                    p5: acc.p5 + (t.profile?.p5 || 0),
                }), { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 });
                
                categoryProfiles[cat] = {
                    profile: {
                        p1: Math.round(sumP.p1 / itemsToCalc.length),
                        p2: Math.round(sumP.p2 / itemsToCalc.length),
                        p3: Math.round(sumP.p3 / itemsToCalc.length),
                        p4: Math.round(sumP.p4 / itemsToCalc.length),
                        p5: Math.round(sumP.p5 / itemsToCalc.length),
                    },
                    count: itemsToCalc.length
                };
            }
        });
        
        // Determine "Top Category" just for default sorting/display purposes
        const catCounts: Record<string, number> = {};
        tastings.forEach(t => catCounts[t.category] = (catCounts[t.category] || 0) + 1);
        const topCategory = Object.keys(catCounts).sort((a,b) => catCounts[b] - catCounts[a])[0] || 'Vino';

        for(let i=5; i>=0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getMonth()+1}/${d.getFullYear()}`; // 5/2024
            months.push(key);
            monthStats[key] = 0;
        }

        tastings.forEach(t => {
            // Category
            if (!catStats[t.category]) catStats[t.category] = { count: 0, sumScore: 0, sumPrice: 0 };
            catStats[t.category].count++;
            catStats[t.category].sumScore += t.score;
            catStats[t.category].sumPrice += getPriceVal(t.price);

            // Country
            if (t.country) {
                countryStats[t.country] = (countryStats[t.country] || 0) + 1;
            }

            // Month
            const d = new Date(t.createdAt);
            const key = `${d.getMonth()+1}/${d.getFullYear()}`;
            if (monthStats[key] !== undefined) monthStats[key]++;
            
            // Tags
            t.tags.forEach(tag => {
                const normalized = tag.trim(); // Already normalized by optimization usually
                if(normalized) tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
            });
            
            // Variety (Taste Preference)
            if (t.variety) {
                if (!varietyStats[t.variety]) varietyStats[t.variety] = { count: 0, totalScore: 0 };
                varietyStats[t.variety].count++;
                varietyStats[t.variety].totalScore += t.score;
            }
        });

        // Format for Charts
        const consumptionData = Object.entries(catStats)
            .map(([k, v]) => ({ label: k, value: v.count, color: getCategoryColor(k, categories) }))
            .sort((a,b) => b.value - a.value);
            
        const preferenceData = Object.entries(catStats)
            .map(([k, v]) => ({ label: k, value: parseFloat((v.sumScore / v.count).toFixed(1)), displayValue: (v.sumScore / v.count).toFixed(1) }))
            .sort((a,b) => b.value - a.value);

        const spendingData = Object.entries(catStats)
            .map(([k, v]) => ({ label: k, value: v.sumPrice, color: getCategoryColor(k, categories) }))
            .filter(d => d.value > 0)
            .sort((a,b) => b.value - a.value);

        const countryList = Object.entries(countryStats)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 5);
        
        const timelineData = months.map(m => ({ label: m.split('/')[0], value: monthStats[m] || 0 }));
        
        // New Data Arrays
        const topTags = Object.entries(tagCounts)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 8)
            .map(([label, value]) => ({ label, value }));

        const topVarieties = Object.entries(varietyStats)
            .filter(([_, data]) => data.count >= 2) // Minimum 2 tastings to be significant
            .map(([label, data]) => ({ label, value: parseFloat((data.totalScore / data.count).toFixed(1)), count: data.count }))
            .sort((a,b) => b.value - a.value)
            .slice(0, 5);

        return {
            totalTastings,
            avgPrice,
            consumptionData,
            preferenceData,
            spendingData,
            countryList,
            timelineData,
            topTags,
            topVarieties,
            categoryProfiles, // Now a map of object { profile, count }
            topCategory
        };

    }, [tastings, categories]);
    
    // Derived active category
    const activeProfileCat = selectedProfileCat || stats?.topCategory || '';

    if (!stats) return (
        <div className="flex flex-col items-center justify-center h-screen bg-dark-950 text-slate-500">
             <Icon name="bar_chart" className="text-4xl mb-2" />
             <p>Registra algunas catas para ver estadísticas.</p>
             <button onClick={() => setView('DASHBOARD')} className="mt-4 text-blue-400">Volver</button>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-dark-950 animate-fade-in pb-8">
             <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-dark-900/95 backdrop-blur sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><Icon name="arrow_back" /></button>
                    <h2 className="font-bold text-white font-serif text-lg">Insights</h2>
                </div>
                <div className="text-[10px] font-bold bg-blue-900/30 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/30">
                    v21.07
                </div>
            </div>

            <div className="p-4 space-y-6 overflow-y-auto">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-dark-800 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
                        <Icon name="attach_money" className="text-green-400 text-2xl mb-2" />
                        <div>
                            <span className="text-xs text-slate-500 uppercase font-bold">Precio Medio</span>
                            <div className="text-2xl font-bold text-white">{currency} {stats.avgPrice.toFixed(0)}</div>
                        </div>
                    </div>
                    <div className="bg-dark-800 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
                        <Icon name="wine_bar" className="text-purple-400 text-2xl mb-2" />
                        <div>
                            <span className="text-xs text-slate-500 uppercase font-bold">Total Catas</span>
                            <div className="text-2xl font-bold text-white">{stats.totalTastings}</div>
                        </div>
                    </div>
                </div>

                {/* --- SECCIÓN NUEVA: ADN DE SABORES --- */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <Icon name="fingerprint" className="text-primary-500" />
                        <h3 className="font-bold text-white font-serif text-lg">ADN de Sabores</h3>
                    </div>

                    {/* Top Tags */}
                    <div className="bg-dark-800 p-5 rounded-2xl border border-slate-800">
                        <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Etiquetas Más Comunes</h3>
                        <div className="flex flex-wrap gap-2">
                            {stats.topTags.map((tag, i) => (
                                <div key={i} className="bg-slate-700/50 px-3 py-2 rounded-lg flex items-center gap-2 border border-slate-700">
                                    <span className="text-sm text-slate-200">{tag.label}</span>
                                    <span className="text-xs font-bold text-primary-400 bg-primary-900/30 px-1.5 rounded-md">{tag.value}</span>
                                </div>
                            ))}
                            {stats.topTags.length === 0 && <span className="text-slate-500 text-sm">Sin datos de etiquetas.</span>}
                        </div>
                    </div>

                    {/* Radar: Ideal Profile With Category Selector */}
                    {Object.keys(stats.categoryProfiles).length > 0 && (
                        <div className="bg-dark-800 p-5 rounded-2xl border border-slate-800 flex flex-col items-center">
                            <h3 className="text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider text-center">Tu Paladar</h3>
                            
                            {/* Category Selector (Dropdown) */}
                            <div className="mb-4 w-full max-w-[200px]">
                                <div className="relative">
                                    <select
                                        value={activeProfileCat}
                                        onChange={(e) => setSelectedProfileCat(e.target.value)}
                                        className="w-full bg-slate-700 text-white text-xs font-bold py-2 pl-3 pr-8 rounded-lg appearance-none border border-slate-600 outline-none focus:border-primary-500 transition"
                                    >
                                        {Object.keys(stats.categoryProfiles).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
                                        <Icon name="expand_more" className="text-sm" />
                                    </div>
                                </div>
                            </div>
                            
                            <p className="text-[10px] text-slate-500 mb-4 text-center">Perfil promedio de <span className="text-white font-bold">{activeProfileCat}</span></p>
                            
                            {stats.categoryProfiles[activeProfileCat] ? (
                                <>
                                    <div className="mb-2 bg-slate-700/50 px-3 py-1 rounded-full border border-slate-600">
                                        <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                                            <Icon name="poll" className="text-primary-400 text-xs" />
                                            Basado en {stats.categoryProfiles[activeProfileCat].count} catas
                                        </span>
                                    </div>
                                    <RadarChart profile={stats.categoryProfiles[activeProfileCat].profile} labels={getProfileLabels(activeProfileCat)} />
                                </>
                            ) : (
                                <p className="text-xs text-slate-500">Sin datos suficientes para esta categoría.</p>
                            )}
                        </div>
                    )}

                    {/* Top Varieties */}
                    <div className="bg-dark-800 p-5 rounded-2xl border border-slate-800">
                        <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Variedades Top (Rating)</h3>
                        <div className="space-y-3">
                            {stats.topVarieties.map((v, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                    <div className="flex justify-between text-xs text-slate-300">
                                        <span className="font-medium">{v.label} <span className="text-slate-500 text-[10px]">({v.count})</span></span>
                                        <span className="text-yellow-400 font-bold">{v.value} ★</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                        <div style={{ width: `${(v.value / 10) * 100}%` }} className="h-full bg-yellow-500 rounded-full"></div>
                                    </div>
                                </div>
                            ))}
                            {stats.topVarieties.length === 0 && <span className="text-slate-500 text-sm">Registra más variedades para ver tu ranking.</span>}
                        </div>
                    </div>
                </div>

                {/* Consumption Donut */}
                <div className="bg-dark-800 p-5 rounded-2xl border border-slate-800 mt-6">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Distribución de Consumo</h3>
                    <div className="flex justify-center">
                        <SimpleDonutChart data={stats.consumptionData} />
                    </div>
                </div>

                {/* Evolution Bar */}
                <div className="bg-dark-800 p-5 rounded-2xl border border-slate-800">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Actividad (6 Meses)</h3>
                    <div className="h-32 flex items-end gap-2 justify-between px-2">
                        {stats.timelineData.map((d, i) => {
                             const max = Math.max(...stats.timelineData.map(t=>t.value)) || 1;
                             const h = (d.value / max) * 100;
                             return (
                                 <div key={i} className="flex flex-col items-center gap-1 flex-1">
                                     <div className="w-full bg-blue-500/20 rounded-t-sm relative h-24 flex items-end">
                                         <div style={{height: `${h}%`}} className="w-full bg-blue-500 rounded-t-sm transition-all duration-1000 min-h-[4px]"></div>
                                     </div>
                                     <span className="text-[10px] text-slate-500">{d.label}</span>
                                 </div>
                             )
                        })}
                    </div>
                </div>

                {/* Preference Score Bar */}
                <div className="bg-dark-800 p-5 rounded-2xl border border-slate-800">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Ranking Categorías</h3>
                    <SimpleBarChart data={stats.preferenceData} color="bg-yellow-500" max={10} />
                </div>

                {/* Spending Donut */}
                <div className="bg-dark-800 p-5 rounded-2xl border border-slate-800">
                     <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Distribución del Gasto</h3>
                     <div className="flex justify-center">
                        <SimpleDonutChart data={stats.spendingData} />
                     </div>
                </div>

                {/* Top Countries List */}
                <div className="bg-dark-800 p-5 rounded-2xl border border-slate-800">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Top Orígenes</h3>
                    <div className="space-y-3">
                        {stats.countryList.map(([country, count], i) => (
                            <div key={country} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-500 font-mono w-4 text-center">{i+1}</span>
                                    <span className="text-2xl">{getCountryFlag(country)}</span>
                                    <span className="text-white text-sm font-medium">{country}</span>
                                </div>
                                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
});