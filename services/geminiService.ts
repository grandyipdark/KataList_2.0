
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

async function retryWrapper<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        // Handle Rate Limit (429) or Server Error (500, 503)
        const isQuotaError = error.status === 429 || error.message?.includes('429') || error.message?.includes('quota');
        const isServerError = error.status === 500 || error.status === 503 || error.message?.includes('500') || error.message?.includes('503');

        if (retries > 0 && (isQuotaError || isServerError)) {
            console.warn(`Gemini API Busy/Limited. Retrying in ${delay}ms...`, error.message);
            await wait(delay);
            // Exponential backoff
            return retryWrapper(operation, retries - 1, delay * 2);
        }
        
        if (isQuotaError) {
            throw new Error("Límite de búsqueda IA alcanzado. Por favor, espera un minuto antes de intentar de nuevo.");
        }
        
        throw error;
    }
}

/**
 * Super robust JSON cleaning for Grounded Search results.
 * Removes [1], [2] citations and markdown artifacts.
 */
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

export const fetchBeverageInfo = async (query: string) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Investiga la ficha técnica real de: "${query}". 
        Responde ÚNICAMENTE con un objeto JSON plano que contenga: name, producer, variety, category, subcategory, country, region, abv (valor numérico), vintage (año). 
        Usa solo datos reales. No añadas texto explicativo.`,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });
      
      const text = response.text || "";
      const data = cleanGroundedJson(text);
      
      if (!data || Object.keys(data).length < 2) {
          throw new Error("No pudimos encontrar información suficiente para esta bebida.");
      }
      return data;
  });
};

export const generateBeverageImage = async (options: { prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" }) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Professional product photography of ${options.prompt}. High resolution, studio lighting, elegant.` }] },
        config: { imageConfig: { aspectRatio: options.aspectRatio } }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("No se pudo generar la imagen en este momento.");
  });
};

export const analyzeLabelFromImage = async (imageBase64: string) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(imageBase64) } },
          { text: `Extrae los datos técnicos en JSON: name, producer, variety, category, subcategory, country, region, abv, vintage.` }
        ],
        config: { responseMimeType: 'application/json' }
      });
      return JSON.parse(response.text || "{}");
  });
};

export const initChatWithEauxDeVie = (inventorySummary?: string) => {
  const ai = getAI();
  let systemInstruction = `Eres "Eaux-de-Vie", Sommelier IA experto. Ayudas con maridajes y dudas técnicas.`;
  if (inventorySummary) systemInstruction += `\n\nBodega:\n${inventorySummary.substring(0, 500)}`;
  return ai.chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction } });
};

export const initGuidedTastingChat = () => {
  const ai = getAI();
  return ai.chats.create({ 
    model: 'gemini-3-flash-preview', 
    config: { systemInstruction: "Guía al usuario en una cata paso a paso. Al final genera un bloque JSON." } 
  });
};

export const suggestSubcategories = async (categoryName: string): Promise<string[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Lista 5 subcategorías para "${categoryName}" en un array JSON de strings.`,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "[]");
};

export const optimizeTagList = async (tags: string[]): Promise<{ original: string, corrected: string }[]> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Normaliza estas etiquetas: ${JSON.stringify(tags)}. Unifica duplicados. JSON array de {original, corrected}.`,
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || "[]");
};

export const analyzeTastingNotes = async (text: string, category: string, profileLabels: string[]) => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analiza: "${text}" (${category}). Extrae etiquetas y perfil 1-5 para: ${profileLabels.join(',')}. JSON format.`,
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || "{}");
};

export const generateReviewFromTags = async (data: any) => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Escribe nota de cata para: ${data.name}. Usando: ${data.tags.join(', ')}. Elegante, 40 palabras.`,
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
  throw new Error("La edición no se completó.");
};
