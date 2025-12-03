
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useKataContext } from '../context/KataContext';
import { Tasting } from '../types';
import { Icon, NeonWineIcon, FormattedMessage, SafeImage, RadarChart } from './Shared';
import { initChatWithEauxDeVie, initGuidedTastingChat } from '../services/geminiService';
import { getProfileLabels } from '../utils/helpers';
import { Chat, GenerateContentResponse } from '@google/genai';

export const EauxDeVieChat = React.memo(() => {
    const { tastings } = useKataContext();
    const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([{role: 'model', text: 'Hola, soy Eaux-de-Vie. ¿En qué puedo ayudarte hoy?'}]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [speakingText, setSpeakingText] = useState<string | null>(null);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initialize Chat (Once)
    useEffect(() => {
        chatRef.current = initChatWithEauxDeVie(); 
        return () => {
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        };
    }, []);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // --- RAG LITE: LOCAL CONTEXT RETRIEVAL ---
    const retrieveRelevantContext = (query: string): string => {
        if (!tastings || tastings.length === 0) return "";
        
        const terms = query.toLowerCase().split(' ').filter(t => t.length > 3);
        
        // Score tastings based on relevance
        const scored = tastings.map(t => {
            let score = 0;
            const fullText = `${t.name} ${t.category} ${t.notes} ${t.tags.join(' ')}`.toLowerCase();
            terms.forEach(term => {
                if (fullText.includes(term)) score += 1;
                if (t.name.toLowerCase().includes(term)) score += 2;
            });
            // Boost favorites slightly to keep them in context if relevant
            if (t.isFavorite) score += 0.5;
            return { t, score };
        });

        // Filter valid scores and sort
        const relevant = scored.filter(item => item.score > 0).sort((a,b) => b.score - a.score).slice(0, 10);
        
        if (relevant.length === 0) return "";

        const contextString = relevant.map(item => 
            `- ${item.t.name} (${item.t.category}, ${item.t.country}). ${item.t.score}/10. ${item.t.vintage ? 'Año ' + item.t.vintage : ''}. Notas: ${item.t.notes.substring(0, 100)}...`
        ).join('\n');

        return `\n[SISTEMA: DATOS RELEVANTES DE LA BODEGA DEL USUARIO PARA ESTA PREGUNTA]:\n${contextString}\n[FIN DATOS]\n`;
    };

    // --- STREAMING SEND ---
    const handleSend = async (textToSend: string = input) => { 
        if (!textToSend.trim() || !chatRef.current) return; 
        
        const userMsg = textToSend; 
        setInput(''); 
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]); 
        setIsLoading(true); 
        
        try { 
            // 1. Get Context (RAG)
            const context = retrieveRelevantContext(userMsg);
            const messageWithContext = context + userMsg;

            // 2. Add placeholder for streaming response
            setMessages(prev => [...prev, { role: 'model', text: '' }]);

            // 3. Start Stream
            const streamResult = await chatRef.current.sendMessageStream({ message: messageWithContext });
            
            let fullText = '';
            
            for await (const chunk of streamResult) {
                const chunkText = (chunk as GenerateContentResponse).text || '';
                fullText += chunkText;
                
                // Update the last message (the placeholder)
                setMessages(prev => {
                    const newArr = [...prev];
                    newArr[newArr.length - 1] = { role: 'model', text: fullText };
                    return newArr;
                });
            }

        } catch (e: any) { 
            console.error(e);
            setMessages(prev => {
                const newArr = [...prev];
                // Check if last message was the placeholder, if so replace, else add error
                if (newArr[newArr.length - 1].role === 'model' && newArr[newArr.length - 1].text === '') {
                    newArr[newArr.length - 1] = { role: 'model', text: `Vuelve a intentarlo. ${e.message || "Error de conexión."}` };
                    return newArr;
                }
                return [...prev, { role: 'model', text: `Vuelve a intentarlo. ${e.message || "Error de conexión."}` }];
            });
        } 
        setIsLoading(false); 
    };

    const handleSpeak = (text: string) => {
        if (!('speechSynthesis' in window)) return;
        if (speakingText === text) {
            window.speechSynthesis.cancel();
            setSpeakingText(null);
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        const voices = window.speechSynthesis.getVoices();
        const esVoices = voices.filter(v => v.lang.toLowerCase().includes('es'));
        // Try to find a good voice
        let selectedVoice = esVoices.find(v => v.name.toLowerCase().includes('iapetus')) || 
                            esVoices.find(v => v.name.includes('Google español')) ||
                            esVoices.find(v => v.name.toLowerCase().includes('male')) ||
                            esVoices[0];
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.pitch = 0.85; 
        utterance.rate = 0.95; 
        utterance.onend = () => setSpeakingText(null);
        utterance.onerror = () => setSpeakingText(null);
        setSpeakingText(text);
        window.speechSynthesis.speak(utterance);
    };

    const quickReplies = ["🍷 ¿Qué bebo hoy?", "🍕 Maridaje Pizza", "🥩 Maridaje Carne", "❓ Explícame Taninos"];

    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
             <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-dark-900/95 backdrop-blur">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white"><NeonWineIcon className="w-6 h-6" /></div>
                 <div><h2 className="font-bold text-white text-sm">Eaux-de-Vie</h2><p className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Online</p></div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {messages.map((m, i) => ( 
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl relative group shadow-sm ${m.role === 'user' ? 'bg-blue-600 rounded-br-none text-white' : 'bg-slate-800 rounded-bl-none text-slate-100'}`}>
                            {m.text === '' ? (
                                <div className="flex gap-1 h-6 items-center px-2">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                </div>
                            ) : (
                                <FormattedMessage text={m.text} role={m.role} />
                            )}
                            
                            {m.role === 'model' && m.text !== '' && (
                                <button onClick={() => handleSpeak(m.text)} className={`absolute -right-8 bottom-0 transition p-2 bg-slate-800/50 rounded-full backdrop-blur ${speakingText === m.text ? 'text-red-400 opacity-100 animate-pulse ring-1 ring-red-400' : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-white'}`}>
                                    <Icon name={speakingText === m.text ? "stop" : "volume_up"} className="text-sm" />
                                </button>
                            )}
                        </div>
                    </div> 
                ))}
                <div ref={messagesEndRef} />
             </div>

             <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
                 {quickReplies.map(q => (
                     <button key={q} onClick={() => handleSend(q)} disabled={isLoading} className="whitespace-nowrap bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-full border border-slate-700 hover:bg-slate-700 active:scale-95 transition disabled:opacity-50">
                         {q}
                     </button>
                 ))}
             </div>

             <div className="p-3 bg-dark-800 border-t border-slate-700 flex gap-2">
                 <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Escribe aquí..." className="flex-1 bg-slate-900 text-white rounded-xl px-4 py-3 outline-none border border-slate-700 focus:border-blue-500 transition-colors" disabled={isLoading} />
                 <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="bg-blue-600 w-12 rounded-xl flex items-center justify-center text-white disabled:opacity-50 disabled:bg-slate-700 transition-all active:scale-95 shadow-lg shadow-blue-900/20"><Icon name="send" /></button>
             </div>
        </div>
    );
});

export const GuidedTasting = React.memo(() => {
    const { setSelectedTasting, setView, showToast } = useKataContext();
    const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [jsonFound, setJsonFound] = useState<any>(null);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => { 
        chatRef.current = initGuidedTastingChat(); 
        (async () => { 
            if (chatRef.current) { 
                setIsLoading(true); 
                try {
                    const res = await chatRef.current.sendMessage({ message: "Hola, quiero iniciar una cata." }); 
                    setMessages([{role: 'model', text: res.text || "Hola."}]); 
                } catch(e: any) {
                    setMessages([{role: 'model', text: `Vuelve a intentarlo. ${e.message || "Error al iniciar."}`}]); 
                }
                setIsLoading(false); 
            } 
        })(); 
    }, []);
    
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    
    const handleSend = async () => { 
        if (!input.trim() || !chatRef.current) return; 
        const userMsg = input; 
        setInput(''); 
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]); 
        setIsLoading(true); 
        
        try { 
            // Add placeholder
            setMessages(prev => [...prev, { role: 'model', text: '' }]);
            
            const resultStream = await chatRef.current.sendMessageStream({ message: userMsg }); 
            
            let fullText = "";
            for await (const chunk of resultStream) {
                fullText += (chunk as GenerateContentResponse).text || "";
                setMessages(prev => {
                    const newArr = [...prev];
                    newArr[newArr.length - 1] = { role: 'model', text: fullText.replace(/```json[\s\S]*?```/g, "✅ ¡Ficha generada!") }; // Hide JSON from stream UI
                    return newArr;
                });
            }

            // Extract JSON after stream completes
            const jsonMatch = fullText.match(/```json([\s\S]*?)```/); 
            if (jsonMatch) { 
                try { 
                    const jsonData = JSON.parse(jsonMatch[1]); 
                    setJsonFound(jsonData); 
                    showToast("¡Ficha generada!", "success"); 
                } catch(e) { console.error(e); } 
            } 
        } catch (e: any) { 
            setMessages(prev => {
                 const newArr = [...prev];
                 newArr[newArr.length - 1] = { role: 'model', text: `Vuelve a intentarlo. ${e.message || "Error de conexión."}` };
                 return newArr;
            });
        } 
        setIsLoading(false); 
    };
    
    const handleCreate = () => { 
        if (jsonFound) { 
            const newTasting: Tasting = { 
                id: Date.now().toString(), 
                name: jsonFound.name || 'Sin Nombre', 
                producer: jsonFound.producer || '', 
                variety: jsonFound.variety || '', 
                category: jsonFound.category || 'Vino', 
                subcategory: jsonFound.subcategory || '', 
                country: jsonFound.country || '', 
                region: jsonFound.region || '', 
                abv: jsonFound.abv || '', 
                vintage: jsonFound.vintage || '', 
                price: '', 
                score: 0, 
                isFavorite: false, 
                isWishlist: false,
                visual: jsonFound.visual || '', 
                aroma: jsonFound.aroma || '', 
                taste: jsonFound.taste || '', 
                notes: jsonFound.notes || '', 
                images: [], 
                tags: [], 
                stock: 0,
                createdAt: Date.now(), 
                updatedAt: Date.now(), 
                profile: { p1: 3, p2: 3, p3: 3, p4: 3, p5: 3 } 
            }; 
            setSelectedTasting(newTasting); 
            setView('NEW'); 
        } 
    };
    
    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
             <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-dark-900/95 backdrop-blur"><h2 className="font-bold text-white text-sm flex items-center gap-2"><Icon name="psychology" className="text-purple-400" /> Cata Guiada</h2><button onClick={() => setView('DASHBOARD')} className="text-slate-400"><Icon name="close" /></button></div>
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m, i) => ( 
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl ${m.role === 'user' ? 'bg-purple-600 rounded-br-none' : 'bg-slate-800 rounded-bl-none'}`}>
                            {m.text === '' ? <span className="animate-pulse">...</span> : <FormattedMessage text={m.text} role={m.role} />}
                        </div>
                    </div> 
                ))}
                <div ref={messagesEndRef} />
             </div>
             {jsonFound && ( <div className="p-4 bg-green-900/20 border-t border-green-900/50 backdrop-blur animate-slide-up"><div className="flex items-center justify-between mb-2"><span className="text-green-400 font-bold text-xs uppercase">Ficha Lista</span><button onClick={handleCreate} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-green-500 transition">Crear Cata</button></div><p className="text-xs text-slate-400 truncate">Datos extraídos: {jsonFound.name}, {jsonFound.category}...</p></div> )}
             <div className="p-3 bg-dark-800 border-t border-slate-700 flex gap-2"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Responde aquí..." className="flex-1 bg-slate-900 text-white rounded-xl px-4 py-3 outline-none border border-slate-700 focus:border-purple-500" disabled={isLoading} /><button onClick={handleSend} disabled={isLoading} className="bg-purple-600 w-12 rounded-xl flex items-center justify-center text-white disabled:opacity-50"><Icon name="send" /></button></div>
        </div>
    );
});

export const CompareView = React.memo(() => {
    const { tastings, compareList, setView, clearCompare } = useKataContext();
    const item1 = tastings.find(t => t.id === compareList[0]);
    const item2 = tastings.find(t => t.id === compareList[1]);
    if (!item1 || !item2) return <div className="p-8 text-center">Faltan datos</div>;
    const labels = getProfileLabels(item1.category);
    return (
        <div className="pb-24 animate-fade-in space-y-4">
            <div className="flex items-center gap-3 p-4 border-b border-slate-800 bg-dark-900/95 sticky top-0 z-10"><button onClick={() => { clearCompare(); setView('SEARCH'); }} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 active:scale-95 transition-transform"><Icon name="arrow_back" /></button><div className="flex-1"><h2 className="font-bold text-white font-serif text-lg">Comparador VS</h2></div></div>
            <div className="bg-dark-800 p-4 mx-4 rounded-2xl border border-slate-800 flex flex-col items-center"><h3 className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">Superposición de Perfil</h3>{item1.profile && item2.profile ? (<RadarChart profile={item1.profile} labels={labels} compareProfile={item2.profile} />) : (<p className="text-slate-500 italic text-sm">Faltan perfiles de sabor</p>)}<div className="flex gap-4 mt-4 text-xs font-bold"><span className="text-neon-green flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neon-green"></span> {item1.name}</span><span className="text-neon-pink flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neon-pink"></span> {item2.name}</span></div></div>
            <div className="grid grid-cols-2 gap-4 px-4">{[item1, item2].map((item, i) => ( <div key={item.id} className={`bg-dark-800 p-3 rounded-xl border-t-4 ${i === 0 ? 'border-neon-green' : 'border-neon-pink'}`}><div className="h-32 rounded-lg bg-slate-900 mb-2 overflow-hidden">{item.images[0] ? <SafeImage src={item.images[0]} className="w-full h-full object-cover" alt={item.name} /> : <div className="w-full h-full flex items-center justify-center"><Icon name="wine_bar" className="text-slate-700" /></div>}</div><h3 className="font-bold text-white text-sm truncate font-serif">{item.name}</h3><p className="text-xs text-slate-400 mb-2">{item.category}</p><div className="space-y-2 text-xs"><div className="flex justify-between border-b border-slate-700 pb-1"><span className="text-slate-500">Puntaje</span><span className={`font-bold ${item.score >= 8 ? 'text-green-400' : 'text-yellow-400'}`}>{item.score}</span></div><div className="flex justify-between border-b border-slate-700 pb-1"><span className="text-slate-500">Precio</span><span className="text-white">{item.price || '-'}</span></div><div className="flex justify-between border-b border-slate-700 pb-1"><span className="text-slate-500">ABV</span><span className="text-white">{item.abv ? item.abv + '%' : '-'}</span></div><div className="flex justify-between border-b border-slate-700 pb-1"><span className="text-slate-500">Año</span><span className="text-white">{item.vintage || '-'}</span></div></div></div> ))}</div>
        </div>
    );
});
