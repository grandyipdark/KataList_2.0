
import React, { useState, useEffect, ReactNode, useRef } from 'react';
import { ViewState, FlavorProfile } from '../types';
import { vibrate } from '../utils/helpers';
import { useKataContext } from '../context/KataContext';
import { useLocation } from 'react-router-dom';
export { FlavorWheel } from './FlavorWheel'; 

export const Icon = React.memo(({ name, className = "" }: { name: string; className?: string }) => (<span className={`material-symbols-rounded select-none ${className}`}>{name}</span>));

export const NeonWineIcon = React.memo(({ className = "" }: { className?: string }) => (<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ filter: "drop-shadow(0 0 3px currentColor)" }}><rect width="24" height="24" fill="none" /><path d="M5.5 2H18.5C19.0523 2 19.5 2.44772 19.5 3V5C19.5 9.97056 16.4706 14 12 14C7.52944 14 4.5 9.97056 4.5 5V3C4.5 2.44772 4.94772 2 5.5 2Z" stroke="#2dd4bf" strokeWidth="2" /><path d="M12 14V22" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round"/><path d="M8 22H16" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round"/><path d="M9 6H15" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round"/><path d="M9 9H15" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round"/><path d="M9 12H12" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round"/><path d="M13 15L15 17L19 13" stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>));

// --- TEXT PARSING COMPONENT ---
export const LinkifiedText = React.memo(({ text }: { text: string }) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
        <span>
            {parts.map((part, i) => 
                part.match(urlRegex) ? (
                    <a key={`link-${i}`} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-medium break-all" onClick={(e) => e.stopPropagation()}>
                        {part} <Icon name="open_in_new" className="text-[10px]" />
                    </a>
                ) : (
                    <React.Fragment key={`text-${i}`}>{part}</React.Fragment>
                )
            )}
        </span>
    );
});

// --- NEW COMPONENT: SWIPEABLE ROW ---
interface SwipeableRowProps {
    children: ReactNode;
    onSwipeLeft?: () => void; // Usually Delete
    onSwipeRight?: () => void; // Usually Favorite/Edit
    threshold?: number;
    className?: string;
}

export const SwipeableRow = React.memo(({ children, onSwipeLeft, onSwipeRight, threshold = 80, className = "" }: SwipeableRowProps) => {
    const [startX, setStartX] = useState(0);
    const [currentX, setCurrentX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const itemRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        setStartX(e.targetTouches[0].clientX);
        setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSwiping) return;
        const x = e.targetTouches[0].clientX;
        const diff = x - startX;
        
        // Only horizontal swipe allowed, prevent vertical scrolling interference
        // CSS touch-action: pan-y handles the scroll locking behavior natively
        
        // Limit swipe distance visually
        if (Math.abs(diff) < 150) {
            setCurrentX(diff);
        }
    };

    const handleTouchEnd = () => {
        if (Math.abs(currentX) > threshold) {
            vibrate(10); // Haptic feedback
            if (currentX > 0 && onSwipeRight) {
                onSwipeRight();
            } else if (currentX < 0 && onSwipeLeft) {
                onSwipeLeft();
            }
        }
        setIsSwiping(false);
        setCurrentX(0); // Reset position
    };

    // Background Colors for actions
    const bgStyle = currentX > 0 ? 'bg-yellow-500' : 'bg-red-500';
    const iconName = currentX > 0 ? 'star' : 'delete';
    const iconPos = currentX > 0 ? 'left-4' : 'right-4';

    return (
        <div className={`relative overflow-hidden rounded-xl mb-3 ${className}`} style={{ touchAction: 'pan-y' }}>
            {/* Background Action Layer */}
            <div className={`absolute inset-0 flex items-center ${bgStyle} transition-colors duration-200`}>
                <Icon name={iconName} className={`absolute ${iconPos} text-white font-bold text-xl`} />
            </div>

            {/* Foreground Content Layer */}
            <div 
                ref={itemRef}
                className="relative bg-white dark:bg-dark-800 transition-transform duration-100 ease-out"
                style={{ transform: `translateX(${currentX}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
});

// --- NEW COMPONENT: TAG INPUT WITH AUTOCOMPLETE ---
interface TagInputProps {
    tags: string[];
    onAddTag: (tag: string) => void;
    onRemoveTag: (tag: string) => void;
    allTags: string[]; // From context
}

export const TagInput = React.memo(({ tags, onAddTag, onRemoveTag, allTags }: TagInputProps) => {
    const [input, setInput] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (input.length > 1) {
            const matches = allTags
                .filter(t => t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t))
                .slice(0, 5);
            setSuggestions(matches);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    }, [input, allTags, tags]);

    const addTag = (tag: string) => {
        onAddTag(tag);
        setInput('');
        setShowSuggestions(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (input.trim()) addTag(input.trim());
        }
    };

    return (
        <div className="relative">
            <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-lg min-h-[40px] border border-slate-200 dark:border-slate-800">
                {tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200 text-xs rounded-md border border-primary-200 dark:border-primary-500/30 flex items-center gap-1 animate-fade-in">
                        {tag}
                        <button onClick={() => onRemoveTag(tag)} className="hover:text-red-500"><Icon name="close" className="text-[10px]" /></button>
                    </span>
                ))}
                <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => input.length > 1 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay to allow click
                    placeholder="Añadir etiqueta..." 
                    className="flex-1 bg-transparent text-slate-800 dark:text-white outline-none text-xs min-w-[80px]" 
                />
            </div>
            
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden mt-1">
                    {suggestions.map(s => (
                        <button 
                            key={s} 
                            onClick={() => addTag(s)} 
                            className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex justify-between items-center"
                        >
                            {s}
                            <Icon name="add" className="text-[10px] opacity-50" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});

// --- SKELETONS ---
export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
    <div className={`bg-slate-200 dark:bg-slate-800/80 animate-pulse ${className}`} />
);

export const SkeletonListItem = () => (
    <div className="flex bg-white dark:bg-dark-800 p-2 rounded-xl mb-3 border border-slate-100 dark:border-slate-800 shadow-sm">
        <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
        <div className="ml-3 flex-1 py-1 space-y-2">
            <div className="flex justify-between">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-4 w-8 rounded" />
            </div>
            <Skeleton className="h-3 w-24 rounded opacity-70" />
            <div className="flex justify-between mt-2">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
            </div>
        </div>
    </div>
);

// New Specific Skeletons
export const SkeletonChef = () => (
    <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="w-32 h-6 rounded" />
                <Skeleton className="w-24 h-3 rounded" />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
    </div>
);

export const SkeletonDashboard = () => (
    <div className="space-y-6 p-4">
        <div className="flex justify-between items-center pt-4">
            <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-32 h-8 rounded-lg" />
            </div>
            <Skeleton className="w-12 h-12 rounded-2xl" />
        </div>
        <Skeleton className="w-full h-24 rounded-2xl" />
        <Skeleton className="w-full h-20 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
        </div>
    </div>
);

export const SkeletonDetail = () => (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-dark-950">
        <div className="h-64 relative">
             <Skeleton className="w-full h-full rounded-b-3xl" />
             <div className="absolute top-4 left-4 right-4 flex justify-between">
                 <Skeleton className="w-10 h-10 rounded-full" />
                 <div className="flex gap-2">
                     <Skeleton className="w-10 h-10 rounded-full" />
                     <Skeleton className="w-10 h-10 rounded-full" />
                 </div>
             </div>
        </div>
        <div className="p-4 space-y-6">
            <div className="space-y-2">
                 <Skeleton className="w-3/4 h-8 rounded-lg" />
                 <Skeleton className="w-1/2 h-4 rounded" />
            </div>
            <div className="grid grid-cols-4 gap-2">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-2">
                 <Skeleton className="h-20 rounded-xl" />
                 <Skeleton className="h-20 rounded-xl" />
            </div>
            <Skeleton className="w-full h-24 rounded-xl" />
            <Skeleton className="w-full h-24 rounded-xl" />
        </div>
    </div>
);

// Optimized SafeImage with Logic to prevent flickering
export const SafeImage = React.memo(({ src, alt, className = "", onClick }: { src?: string, alt: string, className?: string, onClick?: () => void }) => { 
    const [error, setError] = useState(false); 
    const [inView, setInView] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Reset state when src changes
    useEffect(() => { 
        setError(false);
        setIsLoaded(false);
    }, [src]);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setInView(true);
                observer.disconnect();
            }
        }, { rootMargin: "100px" });
        
        if (imgRef.current) observer.observe(imgRef.current);
        return () => observer.disconnect();
    }, []);

    if (error || !src) { 
        return (<div onClick={onClick} className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 ${className}`}><Icon name="broken_image" className="text-2xl mb-1" /><span className="text-[10px] text-center px-1">{alt || 'No img'}</span></div>); 
    } 
    
    return (
        <div ref={imgRef as any} className={`relative ${className} bg-slate-200 dark:bg-slate-700 overflow-hidden`}>
            {inView && (
                <img 
                    src={src} 
                    alt={alt} 
                    className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} 
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setError(true)} 
                    onClick={onClick} 
                />
            )}
        </div>
    );
});

export const FormattedMessage = React.memo(({ text, role }: { text: string, role: 'user' | 'model' }) => { const lines = text.split('\n'); return (<div className={`text-sm leading-relaxed space-y-1 ${role === 'user' ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{lines.map((line, idx) => { const trimmed = line.trim(); const isList = trimmed.startsWith('- ') || trimmed.startsWith('* '); const content = line.replace(/^[-*]\s+/, '').split(/(\*\*.*?\*\*)/g).map((part, i) => { if (part.startsWith('**') && part.endsWith('**')) { return <strong key={i} className={role === 'model' ? "font-bold text-slate-900 dark:text-white" : "font-bold text-white/90"}>{part.slice(2, -2)}</strong>; } return <React.Fragment key={i}>{part}</React.Fragment>; }); if (isList) { return (<div key={idx} className="flex gap-2 ml-2"><span className={role === 'model' ? "text-purple-600 dark:text-purple-400" : "text-white/70"}>•</span><span>{content}</span></div>); } if (!trimmed) return <div key={idx} className="h-2" />; return <div key={idx}>{content}</div>; })}</div>); });

export const DebouncedColorPicker = React.memo(({ value, onChange, className = "" }: { value: string, onChange: (val: string) => void, className?: string }) => { const [color, setColor] = useState(value); useEffect(() => { setColor(value); }, [value]); const handleBlur = () => { if (color !== value) onChange(color); }; return <input type="color" value={color} className={className} onClick={(e) => e.stopPropagation()} onChange={(e) => setColor(e.target.value)} onBlur={handleBlur} />; });

export const AccordionSection = React.memo(({ title, icon, children, isOpen, onToggle, className = "" }: { title: string, icon: string, children: React.ReactNode, isOpen: boolean, onToggle: () => void, className?: string }) => (<div className={`rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden ${isOpen ? 'bg-white dark:bg-dark-800' : 'bg-white/50 dark:bg-dark-800/50'} transition-all duration-300 ${className}`}><button type="button" onClick={(e) => { e.preventDefault(); onToggle(); }} className="w-full flex items-center justify-between p-4 bg-white dark:bg-dark-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition"><span className="flex items-center gap-3 font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wider"><Icon name={icon} className={`text-lg ${isOpen ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500'}`} /> {title}</span><Icon name={isOpen ? "expand_less" : "expand_more"} className="text-slate-400" /></button>{isOpen && <div className="p-4 border-t border-slate-100 dark:border-slate-800 animate-fade-in">{children}</div>}</div>));

export const SpeechMic = React.memo(({ onResult, className = "" }: { onResult: (text: string) => void, className?: string }) => {
    const [listening, setListening] = useState(false);
    const [supported, setSupported] = useState(false);
    useEffect(() => { if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) { setSupported(true); } }, []);
    const toggleListen = (e: React.MouseEvent) => {
        e.preventDefault(); if (!supported) return;
        if (listening) { /* Handled naturally */ } else {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-ES'; recognition.interimResults = false; recognition.maxAlternatives = 1;
            recognition.onstart = () => { setListening(true); vibrate(50); };
            recognition.onend = () => { setListening(false); vibrate(50); };
            recognition.onresult = (event: any) => { const transcript = event.results[0][0].transcript; if (transcript) { onResult(transcript); } };
            try { recognition.start(); } catch(e) { setListening(false); }
        }
    };
    if (!supported) return null;
    return ( <button onClick={toggleListen} aria-label="Dictar voz" className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${listening ? 'bg-red-600 text-white animate-pulse scale-110' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50'} ${className}`} title="Dictar nota"> <Icon name={listening ? "mic_off" : "mic"} className="text-sm" /> </button> );
});

export const Confetti = React.memo(() => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
    const particles = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)]
    }));

    return (
        <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
            {particles.map(p => (
                <div 
                    key={p.id}
                    className="absolute top-0 w-2 h-2 rounded-sm"
                    style={{
                        left: `${p.left}%`,
                        backgroundColor: p.color,
                        animation: `fall ${p.duration}s linear ${p.delay}s infinite`,
                        transformOrigin: 'center'
                    }}
                />
            ))}
            <style>{`@keyframes fall { 0% { transform: translateY(-5vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(105vh) rotate(360deg); opacity: 0; } }`}</style>
        </div>
    );
});

export const SeasonalBackground = React.memo(() => {
    const month = new Date().getMonth();
    let theme = 'none';
    if (month >= 11 || month <= 1) theme = 'winter'; // Dec-Feb
    else if (month >= 2 && month <= 4) theme = 'spring'; // Mar-May
    else if (month >= 5 && month <= 7) theme = 'summer'; // Jun-Aug
    else theme = 'autumn'; // Sep-Nov

    if (theme === 'none') return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-20">
            {theme === 'winter' && (
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/snow.png')] opacity-30 animate-pulse"></div>
            )}
            {theme === 'summer' && (
                <div className="absolute -top-20 -right-20 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl"></div>
            )}
            {theme === 'spring' && (
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-green-900/10 to-transparent"></div>
            )}
            {theme === 'autumn' && (
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-900/10 via-transparent to-transparent"></div>
            )}
        </div>
    );
});

export interface ErrorBoundaryProps {
    children?: ReactNode;
}

export interface ErrorBoundaryState {
    hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };
  declare props: Readonly<ErrorBoundaryProps>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any) { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("Uncaught error:", error, errorInfo); }
  render() { 
      if (this.state.hasError) { 
          return (<div className="min-h-screen bg-gray-50 dark:bg-dark-950 flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-white"><Icon name="dns" className="text-6xl text-red-500 mb-4" /><h2 className="text-2xl font-bold font-serif mb-2">Algo salió mal</h2><button onClick={() => window.location.reload()} className="bg-primary-600 text-white px-6 py-3 rounded-xl font-bold mt-4">Reiniciar Aplicación</button></div>); 
      } 
      return this.props.children; 
  }
}

export const RadarChart = React.memo(({ profile, labels, compareProfile }: { profile: FlavorProfile, labels: string[], compareProfile?: FlavorProfile }) => { const size = 200; const center = size / 2; const radius = size / 2 - 30; const maxVal = 5; const getCoords = (value: number, index: number, total: number) => { const angle = (Math.PI * 2 * index) / total - Math.PI / 2; const r = (value / maxVal) * radius; return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) }; }; const valuesA = [profile.p1, profile.p2, profile.p3, profile.p4, profile.p5]; const pointsA = valuesA.map((v, i) => { const { x, y } = getCoords(v, i, 5); return `${x},${y}`; }).join(' '); let pointsB = ''; if (compareProfile) { const valuesB = [compareProfile.p1, compareProfile.p2, compareProfile.p3, compareProfile.p4, compareProfile.p5]; pointsB = valuesB.map((v, i) => { const { x, y } = getCoords(v, i, 5); return `${x},${y}`; }).join(' '); } return (<div className="flex flex-col items-center"><svg width={size} height={size} className="overflow-visible">{[1, 2, 3, 4, 5].map(level => ( <polygon key={level} points={Array.from({ length: 5 }).map((_, i) => { const { x, y } = getCoords(level, i, 5); return `${x},${y}`; }).join(' ')} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" className="text-slate-400" /> ))}{Array.from({ length: 5 }).map((_, i) => { const { x, y } = getCoords(5, i, 5); return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" className="text-slate-400" />; })}<polygon points={pointsA} fill="rgba(0, 255, 157, 0.2)" stroke="#00ff9d" strokeWidth="2" className="drop-shadow-[0_0_5px_rgba(0,255,157,0.5)]" />{compareProfile && ( <polygon points={pointsB} fill="rgba(255, 0, 255, 0.2)" stroke="#ff00ff" strokeWidth="2" className="drop-shadow-[0_0_5px_rgba(255,0,255,0.5)]" /> )}{labels.map((label, i) => { const { x, y } = getCoords(5.8, i, 5); return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-slate-500 dark:fill-slate-300 font-medium uppercase tracking-wider">{label}</text>; })}</svg></div>); });

export const SimpleBarChart = React.memo(({ data, color = 'bg-primary-500', max }: { data: { label: string, value: number, displayValue?: string }[], color?: string, max?: number }) => {
    const maxValue = max || Math.max(...data.map(d => d.value)) || 1;
    return (
        <div className="flex flex-col gap-3 w-full">
            {data.map((d, i) => (
                <div key={i} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                        <span className="truncate">{d.label}</span>
                        <span>{d.displayValue || d.value}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            style={{ width: `${(d.value / maxValue) * 100}%` }} 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`} 
                        />
                    </div>
                </div>
            ))}
        </div>
    );
});

export const SimpleDonutChart = React.memo(({ data }: { data: { label: string, value: number, color: string }[] }) => {
    const total = data.reduce((acc, d) => acc + d.value, 0);
    let currentAngle = 0;
    const size = 160;
    const center = size / 2;
    const radius = 60;
    const strokeWidth = 20;
    const circumference = 2 * Math.PI * radius;

    if (total === 0) return <div className="h-40 flex items-center justify-center text-slate-500 text-xs">Sin datos</div>;

    return (
        <div className="flex items-center gap-4">
            <div className="relative w-40 h-40 flex-shrink-0">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                    {data.map((d, i) => {
                        const sliceAngle = (d.value / total) * 360;
                        const strokeLength = (d.value / total) * circumference;
                        const space = circumference - strokeLength;
                        const offset = circumference - ((currentAngle / 360) * circumference);
                        
                        const elem = (
                            <circle
                                key={i}
                                r={radius}
                                cx={center}
                                cy={center}
                                fill="transparent"
                                stroke={d.color}
                                strokeWidth={strokeWidth}
                                strokeDasharray={`${strokeLength} ${space}`}
                                strokeDashoffset={offset}
                                className="transition-all duration-1000 ease-out hover:opacity-80"
                            />
                        );
                        currentAngle += sliceAngle;
                        return elem;
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Total</span>
                </div>
            </div>
            <div className="flex flex-col gap-2 text-xs">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></span>
                        <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
                        <span className="font-bold text-slate-900 dark:text-white">({Math.round((d.value/total)*100)}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

export const VirtualList = ({ items, height, itemHeight, renderItem, id }: { items: any[], height: number, itemHeight: number, renderItem: (item: any, index: number) => React.ReactNode, id?: string }) => { const [scrollTop, setScrollTop] = useState(0); const visibleCount = Math.ceil(height / itemHeight); const startIndex = Math.floor(scrollTop / itemHeight); const endIndex = Math.min(items.length, startIndex + visibleCount + 3); const visibleItems = items.slice(startIndex, endIndex).map((item, index) => ({ item, index: startIndex + index })); return (<div id={id} className="overflow-y-auto relative scrollbar-hide" style={{ height }} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}><div style={{ height: items.length * itemHeight, position: 'relative' }}><div style={{ transform: `translateY(${startIndex * itemHeight}px)`, position: 'absolute', top: 0, left: 0, width: '100%' }}>{visibleItems.map(({ item, index }) => ( <div key={item.id || item.key || `idx-${index}`} style={{ height: itemHeight }}>{renderItem(item, index)}</div> ))}</div></div></div>); };

export const ToastContainer = React.memo(({ toasts, removeToast }: { toasts: ToastMessage[], removeToast: (id: number) => void }) => { return (<div className="fixed bottom-24 left-0 right-0 z-[100] pointer-events-none flex flex-col items-center gap-2 px-4">{toasts.map(t => (<div key={t.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-bounce-in max-w-sm w-full font-serif ${t.type === 'success' ? 'bg-green-100 border border-green-300 text-green-900 dark:bg-green-900/90 dark:border-green-500/50 dark:text-green-100' : t.type === 'error' ? 'bg-red-100 border border-red-300 text-red-900 dark:bg-red-900/90 dark:border-red-500/50 dark:text-red-100' : 'bg-white border border-slate-300 text-slate-800 dark:bg-slate-800/90 dark:border-slate-600/50 dark:text-slate-100'}`}><Icon name={t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info'} /><span className="text-sm font-medium flex-1">{t.text}</span><button onClick={() => removeToast(t.id)} className="opacity-70 hover:opacity-100 p-1"><Icon name="close" className="text-sm" /></button></div>))}</div>); });
export interface ToastMessage { id: number; text: string; type: 'success' | 'error' | 'info'; }

export interface ConfirmModalProps { isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; children?: React.ReactNode; }
export const ConfirmModal = React.memo(({ isOpen, title, message, onConfirm, onCancel, children }: ConfirmModalProps) => { if (!isOpen) return null; return (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4"><div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm transform scale-100 animate-slide-up"><div className="flex flex-col items-center text-center mb-4"><Icon name="warning" className="text-red-500 text-3xl mb-2" /><h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">{title}</h3></div><p className="text-slate-600 dark:text-slate-300 text-sm mb-6 text-center">{message}</p>{children}<div className="flex gap-3 mt-4"><button onClick={() => { vibrate(); onCancel(); }} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium active:scale-95 transition-transform">Cancelar</button><button onClick={() => { vibrate(); onConfirm(); }} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-600 shadow-lg shadow-blue-900/50 active:scale-95 transition-transform">Confirmar</button></div></div></div>); });

export interface InputModalProps { isOpen: boolean; title: string; initialValue: string; onConfirm: (val: string) => void; onCancel: () => void; }
export const InputModal = React.memo(({ isOpen, title, initialValue, onConfirm, onCancel }: InputModalProps) => { const [val, setVal] = useState(initialValue); useEffect(() => setVal(initialValue), [initialValue, isOpen]); if (!isOpen) return null; return (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4"><div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm transform scale-100 animate-slide-up"><h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif mb-4 text-center">{title}</h3><input autoFocus value={val} onChange={e => setVal(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-900 p-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white mb-6 outline-none focus:border-primary-500" /><div className="flex gap-3"><button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button><button onClick={() => onConfirm(val)} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-600">Guardar</button></div></div></div>); });

export const AVAILABLE_ICONS = [ 'wine_bar', 'sports_bar', 'liquor', 'local_bar', 'coffee', 'emoji_food_beverage', 'local_drink', 'water_bottle', 'kitchen', 'water_drop', 'nightlife', 'restaurant', 'local_pizza', 'bakery_dining', 'icecream', 'nutrition', 'local_florist', 'grass', 'spa', 'egg', 'set_meal', 'tapas', 'rice_bowl', 'forest', 'terrain', 'wb_sunny', 'science', 'category', 'label', 'star', 'public', 'eco', 'local_fire_department', 'local_cafe', 'bubble_chart', 'filter_vintage', 'grain' ];
export interface IconPickerModalProps { isOpen: boolean; onSelect: (icon: string) => void; onCancel: () => void; }
export const IconPickerModal = React.memo(({ isOpen, onSelect, onCancel }: IconPickerModalProps) => { 
    if (!isOpen) return null; 
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4">
            <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm transform scale-100 animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">Elige un Icono</h3>
                    <button onClick={onCancel} className="text-slate-400"><Icon name="close" /></button>
                </div>
                <div className="grid grid-cols-5 gap-3">
                    {AVAILABLE_ICONS.map(icon => (
                        <button key={icon} onClick={() => onSelect(icon)} aria-label={icon} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/50 hover:bg-primary-100 dark:hover:bg-primary-600/50 flex items-center justify-center text-slate-600 dark:text-white transition active:scale-95">
                            <Icon name={icon} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    ); 
});

export const EmptyState = React.memo(({ message, icon = "wine_bar", action }: { message: string, icon?: string, action?: React.ReactNode }) => ( <div className="flex flex-col items-center justify-center h-64 text-center animate-fade-in opacity-50"> <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-700"> <Icon name={icon} className="text-5xl text-slate-400 dark:text-slate-600" /> </div> <p className="text-slate-500 dark:text-slate-400 font-medium mb-4">{message}</p> {action} </div> ));

export const AppLayout = React.memo(({ children }: { children: React.ReactNode }) => {
    const { setView, isOledMode, setSelectedTasting } = useKataContext();
    const location = useLocation();
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
    const [updateReady, setUpdateReady] = useState(false);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const mainRef = useRef<HTMLDivElement>(null);
    const lastScrollY = useRef(0);
    
    // --- KEYBOARD DETECTION LOGIC ---
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleResize = () => {
            if (window.visualViewport) {
                // If viewport height is < 75% of window innerHeight, keyboard is likely up
                const isKeyOpen = window.visualViewport.height < window.innerHeight * 0.75;
                setIsKeyboardOpen(isKeyOpen);
            }
        };

        window.visualViewport.addEventListener('resize', handleResize);
        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }, []);

    // --- SW UPDATE DETECTION ---
    useEffect(() => {
        const handler = () => setUpdateReady(true);
        window.addEventListener('katalist-sw-update', handler);
        return () => window.removeEventListener('katalist-sw-update', handler);
    }, []);

    // --- AUTO HIDE NAV ON SCROLL ---
    useEffect(() => {
        const handleScroll = () => {
            if (!mainRef.current) return;
            const currentY = mainRef.current.scrollTop;
            const threshold = 50; // Minimum scroll to trigger hide
            
            // Only toggle if we scrolled enough distance or hit top
            if (Math.abs(currentY - lastScrollY.current) > 10) {
                if (currentY > lastScrollY.current && currentY > threshold) {
                    // Scrolling Down
                    setIsNavVisible(false);
                } else {
                    // Scrolling Up
                    setIsNavVisible(true);
                }
            }
            // Always show at top
            if (currentY < threshold) {
                setIsNavVisible(true);
            }
            
            lastScrollY.current = currentY;
        };

        const mainEl = mainRef.current;
        if (mainEl) {
            // PASSIVE LISTENER FIX FOR CHROME PERFORMANCE
            mainEl.addEventListener('scroll', handleScroll, { passive: true });
        }
        return () => mainEl?.removeEventListener('scroll', handleScroll);
    }, []);

    const reloadApp = () => {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
    };
    
    const getActiveId = (path: string) => {
        if (path === '/' || path === '') return 'DASHBOARD';
        if (path === '/search') return 'SEARCH';
        if (path === '/new') return 'NEW';
        if (path === '/chat') return 'AI_CHAT';
        if (path === '/categories') return 'CATEGORIES';
        return '';
    };
    
    const activeId = getActiveId(location.pathname);

    const navItems: { id: string, icon: string, label: string }[] = [ 
        { id: 'DASHBOARD', icon: 'dashboard', label: 'Inicio' }, 
        { id: 'SEARCH', icon: 'search', label: 'Buscar' }, 
        { id: 'NEW', icon: 'add_circle', label: 'Catar' }, 
        { id: 'AI_CHAT', icon: 'chat', label: 'Eaux' }, 
        { id: 'CATEGORIES', icon: 'category', label: 'Datos' } 
    ];
    
    const bgClass = isOledMode ? 'dark:bg-black' : 'dark:bg-dark-950 bg-gray-50';
    
    // Hide Nav if keyboard is open OR if full screen view
    const isFullScreenView = !['/', '/search', '/categories', '/chat'].includes(location.pathname);
    const shouldHideNav = isFullScreenView || isKeyboardOpen || !isNavVisible;

    const handleNav = (id: string) => {
        if (id === 'NEW') setSelectedTasting(null);
        setView(id as ViewState);
    };

    if (isFullScreenView) {
        return (
            <div className={`h-screen w-full overflow-hidden ${bgClass} text-slate-900 dark:text-white font-sans transition-colors duration-300 flex flex-col`}>
                {children}
            </div>
        );
    }
    
    return (
        <div className={`min-h-screen ${bgClass} text-slate-900 dark:text-white font-sans flex flex-col transition-colors duration-300`}>
            {updateReady && (
                <div 
                    onClick={reloadApp}
                    className="bg-primary-600 text-white text-xs font-bold py-2 px-4 text-center cursor-pointer shadow-lg animate-slide-up z-50 fixed top-0 w-full"
                >
                    Nueva versión disponible. <span className="underline">Toca para actualizar</span> 🚀
                </div>
            )}
            
            <main ref={mainRef} className={`flex-1 p-4 overflow-y-auto scrollbar-hide ${shouldHideNav ? 'mb-0' : 'mb-24'} ${updateReady ? 'mt-8' : ''} transition-all duration-300`}>
                {children}
            </main>
            
            <nav className={`fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 bg-white/90 dark:bg-dark-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl p-2 flex justify-between items-center z-50 transition-transform duration-300 ${shouldHideNav ? 'translate-y-[150%]' : 'translate-y-0'}`}>
                {navItems.map(item => (
                    <button key={item.id} onClick={() => handleNav(item.id)} className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 active:scale-95 ${activeId === item.id ? 'bg-slate-100 dark:bg-slate-800 text-primary-500 shadow-inner' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                        {item.id === 'NEW' ? <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-500 to-primary-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/50"><Icon name="add" className="text-xl" /></div> : item.id === 'AI_CHAT' ? <NeonWineIcon className="w-6 h-6" /> : <Icon name={item.icon} className="text-xl" />}
                        {item.id !== 'NEW' && <span className="text-[9px] font-medium mt-1">{item.label}</span>}
                    </button>
                ))}
            </nav>
        </div>
    );
});
