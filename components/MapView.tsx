

import React, { useMemo, useState } from 'react';
import { useKataContext } from '../context/KataContext';
import { Icon } from './Shared';
import { getCountryFlag } from '../utils/helpers';

interface Continent {
    id: string;
    name: string;
    countries: string[];
}

interface ContinentData extends Continent {
    count: number;
    foundCountries: string[];
}

// Fallback visual representation if SVG is too complex to hand-code accurately
// using a grid of bubbles for continents
const CONTINENTS: Continent[] = [
    { id: 'NA', name: 'Norteamérica', countries: ['usa', 'estados unidos', 'canada', 'mexico', 'méxico'] },
    { id: 'SA', name: 'Sudamérica', countries: ['argentina', 'chile', 'uruguay', 'brasil', 'brazil', 'peru', 'colombia'] },
    { id: 'EU', name: 'Europa', countries: ['francia', 'france', 'españa', 'spain', 'italia', 'italy', 'alemania', 'germany', 'portugal', 'uk', 'reino unido', 'escocia', 'scotland', 'irlanda'] },
    { id: 'AS', name: 'Asia', countries: ['japon', 'japan', 'china', 'india', 'turquia'] },
    { id: 'OC', name: 'Oceanía', countries: ['australia', 'nueva zelanda', 'new zealand'] },
    { id: 'AF', name: 'África', countries: ['sudafrica', 'south africa'] }
];

export const MapView = React.memo(() => {
    const { tastings, setView } = useKataContext();
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

    // 1. Map Data Aggregation
    const countryData = useMemo(() => {
        const counts: Record<string, number> = {};
        tastings.forEach(t => {
            if (t.country) {
                const c = t.country.toLowerCase();
                counts[c] = (counts[c] || 0) + 1;
            }
        });
        return counts;
    }, [tastings]);

    const continentData: ContinentData[] = useMemo(() => {
        const data = CONTINENTS.map(cont => {
            let count = 0;
            const foundCountries: string[] = [];
            
            Object.keys(countryData).forEach(c => {
                if (cont.countries.some(match => c.includes(match))) {
                    count += countryData[c];
                    foundCountries.push(c);
                }
            });
            return { ...cont, count, foundCountries };
        });
        return data.sort((a,b) => b.count - a.count);
    }, [countryData]);

    const totalMapped = continentData.reduce((acc, c) => acc + c.count, 0);

    return (
        <div className="flex flex-col h-full bg-dark-950 pb-20 animate-fade-in">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-dark-900/95 backdrop-blur sticky top-0 z-20">
                <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition active:scale-95">
                    <Icon name="arrow_back" />
                </button>
                <div>
                    <h2 className="font-bold text-white font-serif text-lg">Mapa de Origen 🌍</h2>
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">{totalMapped} bebidas localizadas</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* Visual Map Representation (Abstract) */}
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 relative overflow-hidden min-h-[300px] flex flex-wrap gap-4 content-center justify-center">
                    {/* Background Grid */}
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    
                    {continentData.map(cont => {
                        const size = Math.max(80, Math.min(160, 80 + (cont.count * 5))); // Dynamic bubble size
                        const opacity = cont.count > 0 ? 1 : 0.3;
                        
                        return (
                            <button
                                key={cont.id}
                                onClick={() => setSelectedRegion(selectedRegion === cont.id ? null : cont.id)}
                                className={`rounded-full flex flex-col items-center justify-center transition-all duration-500 relative group ${selectedRegion === cont.id ? 'ring-4 ring-primary-500 scale-110 z-10 bg-slate-800' : 'hover:scale-105 bg-slate-800/80'}`}
                                style={{ width: size, height: size, opacity }}
                            >
                                <div className={`text-2xl mb-1 ${cont.count > 0 ? 'text-white' : 'text-slate-600'}`}>
                                    {cont.id === 'EU' ? '🏰' : cont.id === 'SA' ? '🌵' : cont.id === 'NA' ? '🦅' : cont.id === 'AS' ? '🐉' : cont.id === 'OC' ? '🦘' : '🦁'}
                                </div>
                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">{cont.name}</span>
                                <span className={`text-sm font-bold ${cont.count > 0 ? 'text-primary-400' : 'text-slate-600'}`}>{cont.count}</span>
                                
                                {cont.count > 0 && (
                                    <div className="absolute -bottom-1 w-full flex justify-center">
                                        <div className="h-1 bg-primary-500 rounded-full shadow-[0_0_10px_#3b82f6]" style={{ width: `${Math.min(100, cont.count * 5)}%` }}></div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Detailed Stats List */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider pl-2 border-l-2 border-primary-500">
                        {selectedRegion ? `Detalle: ${continentData.find(c=>c.id===selectedRegion)?.name}` : 'Desglose Global'}
                    </h3>
                    
                    <div className="space-y-2">
                        {Object.entries(countryData)
                            .filter(([c]) => !selectedRegion || continentData.find(cont => cont.id === selectedRegion)?.countries.some(match => c.includes(match)))
                            .sort((a, b) => (b[1] as number) - (a[1] as number))
                            .map(([country, count]) => (
                                <div key={country} className="flex items-center justify-between bg-dark-800 p-3 rounded-xl border border-slate-800 animate-slide-up">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{getCountryFlag(country)}</span>
                                        <span className="text-white font-medium capitalize">{country}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary-500" style={{ width: `${Math.min(100, (Number(count) / Number(totalMapped || 1)) * 100)}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-300 w-6 text-right">{count}</span>
                                    </div>
                                </div>
                            ))
                        }
                        {selectedRegion && Object.entries(countryData).filter(([c]) => continentData.find(cont => cont.id === selectedRegion)?.countries.some(match => c.includes(match))).length === 0 && (
                            <p className="text-center text-slate-500 text-sm py-4">No hay bebidas registradas de esta región.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});