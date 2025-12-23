
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
 * Robust retry wrapper with exponential backoff.
 * Especially useful for 429 (Rate Limit) errors on free tiers.
 */
async function retryWrapper<T>(operation: () => Promise<T>, retries = 3, delay = 3000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const isQuotaError = error.status === 429 || error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED');
        const isServerError = error.status === 500 || error.status === 503 || error.message?.includes('500') || error.message?.includes('503');

        if (retries > 0 && (isQuotaError || isServerError)) {
            // Increase delay for quota errors
            const nextDelay = isQuotaError ? delay * 2 : delay + 1000;
            console.warn(`Gemini API Busy (Status: ${error.status}). Retrying in ${nextDelay}ms...`);
            await wait(nextDelay);
            return retryWrapper(operation, retries - 1, nextDelay);
        }
        
        if (isQuotaError) {
            throw new Error("Límite de búsqueda IA alcanzado. Por favor, espera un minuto antes de intentar de nuevo.");
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
        jsonStr = jsonStr.replace(/\[\s*\d+[\s,\d]*\s*\]/g, ""); // Remove citations like [1]
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
        contents: `Ficha técnica de: "${query}". Responde SOLO JSON: {name, producer, variety, category, subcategory, country, region, abv, vintage}.`,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });
      
      const text = response.text || "";
      const data = cleanGroundedJson(text);
      if (!data) throw new Error("No se pudo procesar la información de la bebida.");
      return data;
  });
};

export const generateBeverageImage = async (options: { prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" }) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `High-quality studio photo of ${options.prompt}, isolated, elegant lighting.` }] },
        config: { imageConfig: { aspectRatio: options.aspectRatio } }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("La generación de imagen falló por falta de cuota.");
  }, 2, 4000); // More aggressive wait for images
};

export const analyzeLabelFromImage = async (imageBase64: string) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(imageBase64) } },
          { text: "Extrae datos técnicos en JSON: {name, producer, category, country, abv, vintage}." }
        ],
        config: { responseMimeType: 'application/json' }
      });
      return JSON.parse(response.text || "{}");
  });
};

export const initChatWithEauxDeVie = (inventorySummary?: string) => {
  const ai = getAI();
  let systemInstruction = `Eres "Eaux-de-Vie", Sommelier IA. Ayudas brevemente con maridajes.`;
  return ai.chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction } });
};

export const initGuidedTastingChat = () => {
  const ai = getAI();
  return ai.chats.create({ 
    model: 'gemini-3-flash-preview', 
    config: { systemInstruction: "Guía una cata breve. Al final entrega un JSON." } 
  });
};

export const suggestSubcategories = async (categoryName: string): Promise<string[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `5 subcategorías para "${categoryName}". Solo array JSON de strings.`,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "[]");
};

export const optimizeTagList = async (tags: string[]): Promise<{ original: string, corrected: string }[]> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Normaliza estas etiquetas: ${JSON.stringify(tags)}. JSON array {original, corrected}.`,
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
        contents: `Reseña de 30 palabras para ${data.name} usando ${data.tags.join(', ')}.`,
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
  throw new Error("Fallo en edición.");
};
