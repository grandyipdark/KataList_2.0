
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
 * Super robust retry wrapper.
 */
async function retryWrapper<T>(operation: () => Promise<T>, retries = 2, delay = 5000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const isQuotaError = error.status === 429 || 
                             error.message?.includes('429') || 
                             error.message?.includes('quota') || 
                             error.message?.includes('RESOURCE_EXHAUSTED');
        
        if (retries > 0 && isQuotaError) {
            await wait(delay);
            return retryWrapper(operation, retries - 1, delay * 1.5);
        }
        
        if (isQuotaError) {
            throw new Error("QUOTA_LIMIT");
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
        jsonStr = jsonStr.replace(/\[\s*\d+[\s,\d]*\s*\]/g, ""); 
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
};

/**
 * FETCH BEVERAGE INFO WITH FALLBACK
 * Priority 1: Google Search (Grounded)
 * Priority 2: Internal AI Knowledge (if search quota fails)
 */
export const fetchBeverageInfo = async (query: string) => {
  const ai = getAI();
  
  // STEP 1: Try with Google Search (Best results)
  try {
      return await retryWrapper(async () => {
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Ficha técnica JSON de: "${query}". Campos: name, producer, variety, category, subcategory, country, region, abv, vintage.`,
            config: {
              tools: [{ googleSearch: {} }],
            }
          });
          const data = cleanGroundedJson(response.text || "");
          if (!data) throw new Error("JSON_FAIL");
          return data;
      }, 1, 3000);
  } catch (err: any) {
      if (err.message === "QUOTA_LIMIT" || err.message === "JSON_FAIL") {
          console.warn("Búsqueda con internet fallida. Usando conocimiento interno...");
          // STEP 2: Fallback to internal knowledge (High availability)
          const fallbackResponse = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Genera una ficha técnica aproximada en JSON para: "${query}". Usa solo datos conocidos o genéricos probables. Campos: name, producer, variety, category, subcategory, country, region, abv, vintage.`,
              config: { responseMimeType: "application/json" }
          });
          return JSON.parse(fallbackResponse.text || "{}");
      }
      throw err;
  }
};

export const generateBeverageImage = async (options: { prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" }) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Product photography: ${options.prompt}, elegant.` }] },
        config: { imageConfig: { aspectRatio: options.aspectRatio } }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("FAIL");
  }, 1, 5000); 
};

export const analyzeLabelFromImage = async (imageBase64: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(imageBase64) } },
      { text: "JSON: {name, producer, category, country, abv, vintage}." }
    ],
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{}");
};

export const initChatWithEauxDeVie = (inventorySummary?: string) => {
  const ai = getAI();
  return ai.chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction: `Eres "Eaux-de-Vie", Sommelier IA experto.` } });
};

export const initGuidedTastingChat = () => {
  const ai = getAI();
  return ai.chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction: "Guía una cata breve paso a paso." } });
};

export const suggestSubcategories = async (categoryName: string): Promise<string[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `5 estilos para "${categoryName}". Array JSON de strings.`,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "[]");
};

export const optimizeTagList = async (tags: string[]): Promise<{ original: string, corrected: string }[]> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Normaliza etiquetas: ${JSON.stringify(tags)}. Array JSON {original, corrected}.`,
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || "[]");
};

export const analyzeTastingNotes = async (text: string, category: string, profileLabels: string[]) => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analiza: "${text}" (${category}). JSON {tags:[], profile:{p1..p5}}.`,
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || "{}");
};

export const generateReviewFromTags = async (data: any) => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Reseña corta de ${data.name} usando ${data.tags.join(', ')}.`,
    });
    return response.text?.trim() || "";
};

export const editBeverageImage = async (imageBase64: string, instruction: string) => {
  const ai = getAI();
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
  throw new Error("FAIL");
};
