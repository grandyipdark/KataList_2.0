import { Tasting, Category, FlavorProfile } from '../types';

export const vibrate = (ms = 10) => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); };

export const getAbvVal = (abv: string | undefined): number => { if (!abv) return 0; const clean = abv.toString().replace(',', '.').replace(/[^0-9.]/g, ''); return parseFloat(clean) || 0; };

export const getPriceVal = (price: string | undefined): number => { if (!price) return 0; const clean = price.toString().replace(',', '.').replace(/[^0-9.]/g, ''); return parseFloat(clean) || 0; };

export const getCountryFlag = (countryName: string): string => {
    if (!countryName) return '🌍';
    const lower = countryName.toLowerCase();
    if (lower.includes('chile')) return '🇨🇱';
    if (lower.includes('argentina')) return '🇦🇷';
    if (lower.includes('españa') || lower.includes('spain')) return '🇪🇸';
    if (lower.includes('francia') || lower.includes('france')) return '🇫🇷';
    if (lower.includes('italia') || lower.includes('italy')) return '🇮🇹';
    if (lower.includes('mexico') || lower.includes('méxico')) return '🇲🇽';
    if (lower.includes('usa') || lower.includes('estados unidos')) return '🇺🇸';
    if (lower.includes('alemania') || lower.includes('germany')) return '🇩🇪';
    if (lower.includes('portugal')) return '🇵🇹';
    if (lower.includes('australia')) return '🇦🇺';
    if (lower.includes('uruguay')) return '🇺🇾';
    if (lower.includes('colombia')) return '🇨🇴';
    if (lower.includes('scotland') || lower.includes('escocia')) return '🏴󠁧󠁢󠁳󠁣󠁴󠁿';
    if (lower.includes('ireland') || lower.includes('irlanda')) return '🇮🇪';
    if (lower.includes('japan') || lower.includes('japon')) return '🇯🇵';
    return '🏳️';
};

export const generateCategoryColorHash = (str: string): string => { if (!str) return '#94a3b8'; let hash = 0; for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); } const h = Math.abs(hash) % 360; return `hsl(${h}, 75%, 60%)`; };

export const getCategoryColor = (catName: string, categories: Category[]): string => { const cat = categories.find(c => c.name === catName); if (cat && cat.color) return cat.color; return generateCategoryColorHash(catName); };

export const getProfileLabels = (category: string) => { const c = category.toLowerCase(); if (c.includes('vino') || c.includes('wine')) return ['Dulzor', 'Acidez', 'Taninos', 'Cuerpo', 'Alcohol']; if (c.includes('cerveza') || c.includes('beer')) return ['Malta', 'Amargor', 'Cuerpo', 'Gas', 'Alcohol']; if (c.includes('café') || c.includes('cafe') || c.includes('coffee')) return ['Dulzor', 'Acidez', 'Cuerpo', 'Amargor', 'Final']; if (c.includes('whisky') || c.includes('ron') || c.includes('tequila') || c.includes('mezcal') || c.includes('destilado')) return ['Dulzor', 'Especias', 'Cuerpo', 'Complejidad', 'Final']; return ['Dulzor', 'Acidez', 'Cuerpo', 'Intensidad', 'Final']; };

export const getDrinkingStatus = (from?: string, to?: string) => { if (!from && !to) return 'UNKNOWN'; const currentYear = new Date().getFullYear(); const f = from ? parseInt(from) : 0; const t = to ? parseInt(to) : 9999; if (currentYear < f) return 'HOLD'; if (currentYear > t) return 'PAST'; return 'READY'; };

// --- IMAGE OPTIMIZATION (WEB WORKER) ---

// Worker Script as a string to avoid external file dependencies in this architecture
const COMPRESSION_WORKER_CODE = `
self.onmessage = async (e) => {
  const { file, maxWidth, quality } = e.data;
  
  try {
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;

    // Calculate aspect ratio fit
    if (width > maxWidth) {
        height = Math.floor((height * maxWidth) / width);
        width = maxWidth;
    }

    // Use OffscreenCanvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Convert to Blob (WebP is best for mobile)
    const blob = await canvas.convertToBlob({
        type: 'image/webp',
        quality: quality
    });

    // Convert Blob to Base64 to send back to main thread
    const reader = new FileReader();
    reader.onloadend = () => {
        self.postMessage({ success: true, data: reader.result });
    };
    reader.readAsDataURL(blob);

  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};
`;

const createWorker = () => {
    const blob = new Blob([COMPRESSION_WORKER_CODE], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
};

// Fallback for older browsers (Main Thread)
const compressImageFallback = (base64OrFile: string | File, maxWidth = 1200, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
        // If File, convert to base64 first for standard Image handling
        if (base64OrFile instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const b64 = e.target?.result as string;
                runCanvasLogic(b64);
            };
            reader.readAsDataURL(base64OrFile);
        } else {
            runCanvasLogic(base64OrFile);
        }

        function runCanvasLogic(src: string) {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/webp', quality));
                } else {
                    resolve(src);
                }
            };
            img.onerror = () => resolve(src);
        }
    });
};

/**
 * Main Compression Function
 * Accepts File object (preferred) or Base64 string.
 * Uses Web Worker if OffscreenCanvas is supported, otherwise falls back to main thread.
 */
export const compressImage = async (input: File | string, maxWidth = 1200, quality = 0.75): Promise<string> => {
    // Feature detect OffscreenCanvas in Worker scope support
    // (Simplification: Check if window.OffscreenCanvas exists, usually implies modern browser)
    if (typeof window !== 'undefined' && 'OffscreenCanvas' in window && 'Worker' in window) {
        return new Promise((resolve) => {
            const worker = createWorker();
            
            // Prepare input: if string, convert to Blob/File
            let fileInput: Blob;
            if (typeof input === 'string') {
                try {
                    const arr = input.split(',');
                    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while(n--){
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    fileInput = new Blob([u8arr], {type: mime});
                } catch(e) {
                    console.warn("Invalid base64 input for worker, falling back");
                    compressImageFallback(input, maxWidth, quality).then(resolve);
                    return;
                }
            } else {
                fileInput = input;
            }

            worker.onmessage = (e) => {
                worker.terminate(); // Cleanup immediately
                if (e.data.success) {
                    resolve(e.data.data);
                } else {
                    console.warn("Worker compression failed, using fallback:", e.data.error);
                    compressImageFallback(input, maxWidth, quality).then(resolve);
                }
            };

            worker.onerror = (e) => {
                worker.terminate();
                console.warn("Worker error:", e);
                compressImageFallback(input, maxWidth, quality).then(resolve);
            };

            // Send data
            worker.postMessage({ file: fileInput, maxWidth, quality });
        });
    } else {
        // Legacy Fallback
        return compressImageFallback(input, maxWidth, quality);
    }
};

// Memory Optimization: Convert Base64 to Blob URL for transient display
export const base64ToBlobUrl = (base64: string): string => {
    try {
        const byteString = atob(base64.split(',')[1]);
        const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        return URL.createObjectURL(blob);
    } catch (e) {
        return base64; // Fallback to raw string if fails
    }
};

export type SocialTheme = 'NEON' | 'MINIMAL' | 'ELEGANT';

export const generateSocialCard = async (tasting: Tasting, categoryColor: string, fullImageSrc?: string, theme: SocialTheme = 'NEON'): Promise<Blob | null> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;

    // --- Background & Theme Colors ---
    let textColor = '#ffffff';
    let subTextColor = '#cbd5e1';
    let accentColor = categoryColor;
    let scoreRingColor = 'rgba(0,0,0,0.3)';
    
    if (theme === 'NEON') {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0f172a'); 
        gradient.addColorStop(1, categoryColor); 
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        for(let i=0; i<100; i++) ctx.fillRect(Math.random()*width, Math.random()*height, 2, 2);
    } 
    else if (theme === 'MINIMAL') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        textColor = '#1e293b';
        subTextColor = '#64748b';
        accentColor = '#0f172a';
        scoreRingColor = '#f1f5f9';
    }
    else if (theme === 'ELEGANT') {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);
        // Gold border
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 40, width - 80, height - 80);
        textColor = '#f8fafc';
        subTextColor = '#94a3b8';
        accentColor = '#d4af37'; // Gold
        scoreRingColor = 'rgba(212, 175, 55, 0.1)';
    }

    // --- Image ---
    const imgSrc = fullImageSrc || tasting.thumbnail;
    if (imgSrc) {
        try {
            const img = new Image();
            img.src = imgSrc;
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
            const imgSize = 900;
            const x = (width - imgSize) / 2;
            const y = 200;
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x, y, imgSize, imgSize, 40);
            ctx.clip();
            const scale = Math.max(imgSize / img.width, imgSize / img.height);
            const ix = x + (imgSize - img.width * scale) / 2;
            const iy = y + (imgSize - img.height * scale) / 2;
            ctx.drawImage(img, ix, iy, img.width * scale, img.height * scale);
            ctx.restore();
            
            // Image Border
            ctx.strokeStyle = theme === 'MINIMAL' ? 'rgba(0,0,0,0.05)' : theme === 'ELEGANT' ? '#d4af37' : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, imgSize, imgSize);
        } catch (e) { console.error("Error loading image for canvas", e); }
    }

    // --- Text ---
    ctx.textAlign = 'center';
    
    // Name
    ctx.fillStyle = textColor;
    ctx.font = 'bold 80px "Playfair Display", serif';
    // Wrap text if too long
    const name = tasting.name;
    if (ctx.measureText(name).width > 900) {
         ctx.font = 'bold 60px "Playfair Display", serif';
    }
    ctx.fillText(name, width / 2, 1250);

    // Subtitle
    ctx.font = '40px "Inter", sans-serif';
    ctx.fillStyle = subTextColor;
    const subtitle = `${tasting.category} • ${tasting.country} ${getCountryFlag(tasting.country)} • ${tasting.vintage || 'NV'}`;
    ctx.fillText(subtitle, width / 2, 1330);

    // Score
    const scoreY = 1500;
    ctx.beginPath();
    ctx.arc(width / 2, scoreY, 100, 0, Math.PI * 2);
    ctx.fillStyle = scoreRingColor;
    ctx.fill();
    
    ctx.strokeStyle = theme === 'ELEGANT' ? '#d4af37' : (tasting.score >= 8 ? '#4ade80' : '#facc15');
    ctx.lineWidth = 8;
    ctx.stroke();
    
    ctx.fillStyle = textColor;
    ctx.font = 'bold 90px "Inter", sans-serif';
    ctx.fillText(tasting.score.toString(), width / 2, scoreY + 30);

    // Notes
    ctx.font = 'italic 36px "Playfair Display", serif';
    ctx.fillStyle = subTextColor;
    const notes = tasting.notes.length > 80 ? tasting.notes.substring(0, 80) + '...' : tasting.notes;
    ctx.fillText(`"${notes}"`, width / 2, 1700);

    // Footer
    ctx.font = '30px "Inter", sans-serif';
    ctx.fillStyle = theme === 'MINIMAL' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)';
    ctx.fillText("Generado con KataList App", width / 2, 1850);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
};