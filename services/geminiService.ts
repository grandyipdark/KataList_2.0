
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  // Always use direct process.env.API_KEY according to guidelines
  if (!process.env.API_KEY) {
    throw new Error("Falta la API Key.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const cleanBase64 = (b64: string) => b64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Global state to track heavy quota errors (like Google Search Grounding)
let lastQuotaErrorTime = 0;
const QUOTA_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Super robust retry wrapper for 429 errors.
 */
async function retryWrapper<T>(operation: () => Promise<T>, retries = 2, delay = 5000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const isQuotaError = error.status === 429 || 
                             error.message?.includes('429') || 
                             error.message?.includes('quota') || 
                             error.message?.includes('RESOURCE_EXHAUSTED');
        
        if (isQuotaError) {
            lastQuotaErrorTime = Date.now();
            if (retries > 0) {
                await wait(delay);
                return retryWrapper(operation, retries - 1, delay * 2);
            }
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
    } catch (e) { return null; }
};

/**
 * FETCH BEVERAGE INFO WITH SMART QUOTA MANAGEMENT
 */
export const fetchBeverageInfo = async (query: string) => {
  const ai = getAI();
  const isCooldownActive = (Date.now() - lastQuotaErrorTime) < QUOTA_COOLDOWN_MS;

  // STEP 1: Try with Google Search ONLY if we haven't had a recent quota error
  if (!isCooldownActive) {
      try {
          return await retryWrapper(async () => {
              const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Responde SOLO JSON para: "${query}". Campos: name, producer, variety, category, subcategory, country, region, abv, vintage.`,
                config: { tools: [{ googleSearch: {} }] }
              });
              const data = cleanGroundedJson(response.text || "");
              if (!data) throw new Error("JSON_FAIL");
              return data;
          }, 1, 3000);
      } catch (err: any) {
          console.warn("Búsqueda con internet fallida o saturada. Cambiando a modo Conocimiento Interno.");
      }
  }

  // STEP 2: Fallback to internal knowledge (Much higher quota availability)
  const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Genera ficha técnica probable en JSON para: "${query}". Campos: name, producer, variety, category, subcategory, country, region, abv, vintage.`,
      config: { responseMimeType: "application/json" }
  });
  return JSON.parse(fallbackResponse.text || "{}");
};

export const generateBeverageImage = async (options: { prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" }) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Product photo: ${options.prompt}, isolated, studio lighting.` }] },
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
  // Fixed contents format: should be an object with parts array
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(imageBase64) } },
        { text: "Extrae JSON: {name, producer, category, country, abv, vintage}." }
      ]
    },
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
    contents: `5 estilos para "${categoryName}". Array JSON strings.`,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "[]");
};

export const optimizeTagList = async (tags: string[]): Promise<{ original: string, corrected: string }[]> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Normaliza: ${JSON.stringify(tags)}. Array JSON {original, corrected}.`,
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
        contents: `Reseña de ${data.name} usando ${data.tags.join(', ')}.`,
    });
    return response.text?.trim() || "";
};

export const editBeverageImage = async (imageBase64: string, instruction: string) => {
  const ai = getAI();
  // Fixed contents format: should be an object with parts array
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/png', data: cleanBase64(imageBase64) } },
        { text: instruction }
      ]
    }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("FAIL");
};
