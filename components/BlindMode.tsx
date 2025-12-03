import React, { useState, useMemo } from 'react';
import { useKataContext } from '../context/KataContext';
import { Icon, SafeImage, RadarChart, InputModal, Confetti } from './Shared';
import { Tasting, FlavorProfile } from '../types';
import { getProfileLabels, getCategoryColor } from '../utils/helpers';

export const BlindMode = React.memo(() => {
    const { tastings, setView, categories, showToast } = useKataContext();
    const [step, setStep] = useState<'GUESS' | 'REVEAL' | 'RESULT'>('GUESS');
    
    // Guess State
    const [guessVisual, setGuessVisual] = useState('');
    const [guessAroma, setGuessAroma] = useState('');
    const [guessTaste, setGuessTaste] = useState('');
    const [guessProfile, setGuessProfile] = useState<FlavorProfile>({ p1:3, p2:3, p3:3, p4:3, p5:3 });
    const [guessCategory, setGuessCategory] = useState('');
    const [guessPrice, setGuessPrice] = useState('');
    
    // Reveal State
    const [selectedRealId, setSelectedRealId] = useState<string | null>(null);
    const [searchReveal, setSearchReveal] = useState('');
    const [showWinConfetti, setShowWinConfetti] = useState(false);

    const realTasting = useMemo(() => tastings.find(t => t.id === selectedRealId), [selectedRealId, tastings]);
    
    const filteredRevealList = useMemo(() => {
        if(!searchReveal) return [];
        return tastings.filter(t => t.name.toLowerCase().includes(searchReveal.toLowerCase()));
    }, [tastings, searchReveal]);

    const calculateScore = () => {
        if (!realTasting) return 0;
        let points = 0;
        
        // 1. Category Match (20pts)
        if (guessCategory === realTasting.category) points += 20;
        
        // 2. Profile Match (40pts)
        if (realTasting.profile) {
            const diff = 
                Math.abs(realTasting.profile.p1 - guessProfile.p1) +
                Math.abs(realTasting.profile.p2 - guessProfile.p2) +
                Math.abs(realTasting.profile.p3 - guessProfile.p3) +
                Math.abs(realTasting.profile.p4 - guessProfile.p4) +
                Math.abs(realTasting.profile.p5 - guessProfile.p5);
            const profileScore = Math.max(0, 40 - (diff * 2));
            points += profileScore;
        }

        // 3. Price Estimation (20pts)
        const realPrice = parseFloat(realTasting.price) || 0;
        const guessedPriceVal = parseFloat(guessPrice) || 0;
        if (realPrice > 0 && guessedPriceVal > 0) {
            const ratio = guessedPriceVal / realPrice;
            if (ratio >= 0.8 && ratio <= 1.2) points += 20;
            else if (ratio >= 0.6 && ratio <= 1.4) points += 10;
        }

        // 4. Notes Effort (20pts)
        if (guessVisual.length > 5) points += 5;
        if (guessAroma.length > 5) points += 10;
        if (guessTaste.length > 5) points += 5;

        return Math.round(points);
    };

    const finalScore = useMemo(calculateScore, [realTasting, guessCategory, guessProfile, guessPrice, guessVisual, guessAroma, guessTaste]);

    // Effect to trigger win state
    const handleShowResult = () => {
        setStep('RESULT');
        if (finalScore >= 80) {
            setShowWinConfetti(true);
            showToast("¡Excelente! +50 XP Extra", "success");
            setTimeout(() => setShowWinConfetti(false), 5000);
        }
    };

    const handleProfileChange = (p: keyof FlavorProfile, v: number) => {
        setGuessProfile(prev => ({ ...prev, [p]: v }));
    };

    return (
        <div className="flex flex-col h-full bg-dark-950 pb-20 animate-fade-in relative">
            {showWinConfetti && <Confetti />}
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-dark-900/95 backdrop-blur sticky top-0 z-20">
                <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition active:scale-95">
                    <Icon name="arrow_back" />
                </button>
                <div>
                    <h2 className="font-bold text-white font-serif text-lg">Cata a Ciegas 🎭</h2>
                    <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Entrena tu paladar</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* STEP 1: GUESS */}
                {step === 'GUESS' && (
                    <div className="animate-slide-up space-y-6">
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 text-center">
                            <Icon name="visibility_off" className="text-4xl text-slate-500 mb-2" />
                            <p className="text-slate-300 text-sm">Sirve una copa, oculta la botella y describe lo que sientes sin prejuicios.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-dark-800 p-4 rounded-xl border border-slate-700">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">1. Análisis Sensorial</h3>
                                <div className="space-y-3">
                                    <input value={guessVisual} onChange={e => setGuessVisual(e.target.value)} placeholder="Visual (Color, densidad...)" className="w-full bg-slate-900 p-3 rounded-lg text-sm text-white border border-slate-700 outline-none focus:border-purple-500" />
                                    <input value={guessAroma} onChange={e => setGuessAroma(e.target.value)} placeholder="Aroma (Frutas, madera...)" className="w-full bg-slate-900 p-3 rounded-lg text-sm text-white border border-slate-700 outline-none focus:border-purple-500" />
                                    <input value={guessTaste} onChange={e => setGuessTaste(e.target.value)} placeholder="Gusto (Ataque, cuerpo, final...)" className="w-full bg-slate-900 p-3 rounded-lg text-sm text-white border border-slate-700 outline-none focus:border-purple-500" />
                                </div>
                            </div>

                            <div className="bg-dark-800 p-4 rounded-xl border border-slate-700">
                                <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase">2. Perfil Estructural</h3>
                                <div className="space-y-4">
                                    {['Dulzor', 'Acidez', 'Taninos/Amargor', 'Cuerpo', 'Alcohol'].map((label, i) => {
                                        const key = `p${i+1}` as keyof FlavorProfile;
                                        return (
                                            <div key={key} className="flex items-center gap-3">
                                                <span className="w-24 text-xs text-slate-400 text-right">{label}</span>
                                                <input type="range" min="1" max="5" step="1" value={guessProfile[key]} onChange={e => handleProfileChange(key, parseInt(e.target.value))} className="flex-1 accent-purple-500 h-1.5 bg-slate-700 rounded-lg appearance-none" />
                                                <span className="w-4 text-xs font-bold text-slate-300">{guessProfile[key]}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-dark-800 p-4 rounded-xl border border-slate-700">
                                <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase">3. Tus Apuestas</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-slate-500 mb-1 block">¿Qué crees que es?</label>
                                        <select value={guessCategory} onChange={e => setGuessCategory(e.target.value)} className="w-full bg-slate-900 p-3 rounded-lg text-sm text-white border border-slate-700 outline-none appearance-none">
                                            <option value="">Selecciona...</option>
                                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 mb-1 block">Precio Estimado</label>
                                        <input type="number" value={guessPrice} onChange={e => setGuessPrice(e.target.value)} placeholder="0" className="w-full bg-slate-900 p-3 rounded-lg text-sm text-white border border-slate-700 outline-none" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => setStep('REVEAL')} disabled={!guessCategory} className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold text-white shadow-lg hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed">
                            ¡Destapar Botella! 🍾
                        </button>
                    </div>
                )}

                {/* STEP 2: REVEAL (LINK TO EXISTING) */}
                {step === 'REVEAL' && (
                    <div className="animate-slide-up space-y-4">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-serif font-bold text-white">¿Qué era en realidad?</h3>
                            <p className="text-slate-400 text-sm">Busca la botella en tu bodega para comparar.</p>
                        </div>

                        <div className="relative">
                            <Icon name="search" className="absolute left-3 top-3 text-slate-500" />
                            <input 
                                autoFocus
                                value={searchReveal} 
                                onChange={e => setSearchReveal(e.target.value)} 
                                placeholder="Buscar en tu lista..." 
                                className="w-full bg-slate-800 pl-10 pr-4 py-3 rounded-xl border border-slate-700 text-white outline-none focus:border-purple-500" 
                            />
                        </div>

                        <div className="space-y-2">
                            {filteredRevealList.slice(0, 5).map(t => (
                                <div key={t.id} onClick={() => { setSelectedRealId(t.id); handleShowResult(); }} className="flex items-center gap-3 bg-dark-800 p-3 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-700 transition">
                                    <div className="w-12 h-12 rounded-lg bg-slate-600 overflow-hidden">
                                        {t.images[0] ? <SafeImage src={t.images[0]} className="w-full h-full object-cover" alt={t.name} /> : <div className="w-full h-full flex items-center justify-center"><Icon name="image" /></div>}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">{t.name}</h4>
                                        <p className="text-xs text-slate-400">{t.category} • {t.vintage}</p>
                                    </div>
                                </div>
                            ))}
                            {searchReveal && filteredRevealList.length === 0 && (
                                <p className="text-center text-slate-500 text-sm py-4">No encontrado. <button onClick={() => setView('NEW')} className="text-purple-400 font-bold">Registrar ahora</button></p>
                            )}
                        </div>
                        
                        <button onClick={() => setStep('GUESS')} className="w-full py-3 text-slate-400 text-sm font-bold">Volver</button>
                    </div>
                )}

                {/* STEP 3: RESULT */}
                {step === 'RESULT' && realTasting && (
                    <div className="animate-slide-up space-y-6">
                        <div className="text-center">
                            <div className="w-24 h-24 mx-auto rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center mb-4 relative">
                                <span className={`text-4xl font-bold ${finalScore >= 80 ? 'text-green-400' : finalScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{finalScore}</span>
                                <div className="absolute -bottom-2 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-700 text-[10px] text-slate-300 uppercase font-bold">Puntos</div>
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-white mb-1">{finalScore >= 80 ? '¡Gran Paladar!' : finalScore >= 50 ? 'Buen Intento' : 'Sigue Practicando'}</h3>
                            <p className="text-slate-400 text-sm">Acierto en cata a ciegas</p>
                        </div>

                        <div className="bg-dark-800 p-4 rounded-2xl border border-slate-700 space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                                <span className="text-xs text-slate-500 uppercase font-bold">Categoría</span>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400 line-through mr-1">{guessCategory !== realTasting.category ? guessCategory : ''}</div>
                                    <div className={`font-bold ${guessCategory === realTasting.category ? 'text-green-400' : 'text-red-400'}`}>{realTasting.category}</div>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                                <span className="text-xs text-slate-500 uppercase font-bold">Precio</span>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">Tú: {guessPrice}</div>
                                    <div className="font-bold text-white">Real: {realTasting.price}</div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <h4 className="text-xs text-slate-500 uppercase font-bold mb-2 text-center">Comparativa de Perfil</h4>
                                <RadarChart profile={realTasting.profile || {p1:0,p2:0,p3:0,p4:0,p5:0}} labels={getProfileLabels(realTasting.category)} compareProfile={guessProfile} />
                                <div className="flex justify-center gap-4 mt-2 text-[10px] font-bold">
                                    <span className="text-neon-green">● Realidad</span>
                                    <span className="text-neon-pink">● Tu Percepción</span>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => { setStep('GUESS'); setGuessVisual(''); setGuessAroma(''); setGuessTaste(''); setSelectedRealId(null); setSearchReveal(''); setShowWinConfetti(false); }} className="w-full py-4 bg-slate-800 border border-slate-700 rounded-xl font-bold text-white hover:bg-slate-700 transition">
                            Jugar Otra Vez 🔄
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
});