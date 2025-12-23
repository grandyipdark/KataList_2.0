
import { GoogleGenAI, Type, Schema } from "@google/genai";

const getAI = () => {
  let key = process.env.API_KEY || '';
  key = key.replace(/["']/g, '').trim();
  if (!key || key === 'undefined' || key === '') {
    throw new Error("Falta la API Key.");
  }
  return new GoogleGenAI({ apiKey: key });
};

const cleanBase64 = (b64: string) => b64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Enhanced Retry Wrapper for 429 Quota issues.
 * Google Search Grounding is very sensitive to RPM limits.
 */
async function retryWrapper<T>(operation: () => Promise<T>, retries = 2, delay = 6000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const isQuotaError = error.status === 429 || 
                             error.message?.includes('429') || 
                             error.message?.includes('quota') || 
                             error.message?.includes('RESOURCE_EXHAUSTED');
        
        if (retries > 0 && isQuotaError) {
            console.warn(`Cuota agotada temporalmente. Reintentando en ${delay/1000}s...`);
            await wait(delay);
            // We increase delay significantly for quota errors to allow the 1-minute window to reset
            return retryWrapper(operation, retries - 1, delay * 2);
        }
        
        if (isQuotaError) {
            throw new Error("Límite de búsqueda IA alcanzado. Por favor, espera 60 segundos antes de intentar de nuevo.");
        }
        
        throw error;
    }
}

const cleanGroundedJson = (text: string) => {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        let jsonStr = text.substring(start, end + 1);
        jsonStr = jsonStr.replace(/```json|```/g, "");
        // Remove citations like [1] that grounding adds and break JSON
        jsonStr = jsonStr.replace(/\[\s*\d+[\s,\d]*\s*\]/g, ""); 
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
};

export const fetchBeverageInfo = async (query: string) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Info de: "${query}". Responde SOLO JSON: {name, producer, variety, category, subcategory, country, region, abv, vintage}.`,
        config: {
          tools: [{ googleSearch: {} }], // Grounding consumes most quota
        }
      });
      
      const text = response.text || "";
      const data = cleanGroundedJson(text);
      if (!data) throw new Error("No se pudo extraer la información. Reintenta en un minuto.");
      return data;
  });
};

export const generateBeverageImage = async (options: { prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" }) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Elegant product photo: ${options.prompt}, studio lighting.` }] },
        config: { imageConfig: { aspectRatio: options.aspectRatio } }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Imagen no generada por límite de servicio.");
  }, 1, 8000); 
};

export const analyzeLabelFromImage = async (imageBase64: string) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(imageBase64) } },
          { text: "JSON: {name, producer, category, country, abv, vintage}." }
        ],
        config: { responseMimeType: 'application/json' }
      });
      return JSON.parse(response.text || "{}");
  });
};

export const initChatWithEauxDeVie = (inventorySummary?: string) => {
  const ai = getAI();
  let systemInstruction = `Eres "Eaux-de-Vie", Sommelier IA. Ayudas brevemente.`;
  return ai.chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction } });
};

export const initGuidedTastingChat = () => {
  const ai = getAI();
  return ai.chats.create({ 
    model: 'gemini-3-flash-preview', 
    config: { systemInstruction: "Guía una cata breve. Entrega JSON al final." } 
  });
};

export const suggestSubcategories = async (categoryName: string): Promise<string[]> => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `5 subcategorías para "${categoryName}". Solo array JSON de strings.`,
        config: { responseMimeType: 'application/json' }
      });
      return JSON.parse(response.text || "[]");
  });
};

export const optimizeTagList = async (tags: string[]): Promise<{ original: string, corrected: string }[]> => {
    const ai = getAI();
    return await retryWrapper(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Normaliza: ${JSON.stringify(tags)}. JSON array {original, corrected}.`,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || "[]");
    });
};

export const analyzeTastingNotes = async (text: string, category: string, profileLabels: string[]) => {
    const ai = getAI();
    return await retryWrapper(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analiza: "${text}" (${category}). JSON {tags:[], profile:{p1..p5}}.`,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || "{}");
    });
};

export const generateReviewFromTags = async (data: any) => {
    const ai = getAI();
    return await retryWrapper(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Reseña corta (30 pal) para ${data.name} con ${data.tags.join(', ')}.`,
        });
        return response.text?.trim() || "";
    });
};

export const editBeverageImage = async (imageBase64: string, instruction: string) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64(imageBase64) } },
          { text: instruction }
        ]
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("No se pudo completar la edición.");
  });
};
