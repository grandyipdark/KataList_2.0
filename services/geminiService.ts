
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

async function retryWrapper<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        if (retries > 0 && (error.status === 429 || error.status === 503 || error.message?.includes('429') || error.message?.includes('503'))) {
            await wait(delay);
            return retryWrapper(operation, retries - 1, delay * 2);
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
        // 1. Find the main JSON block
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        
        let jsonStr = text.substring(start, end + 1);
        
        // 2. Remove markdown code block markers
        jsonStr = jsonStr.replace(/```json|```/g, "");
        
        // 3. Remove citations like [1], [2], [1, 2] inside the JSON string
        // This regex looks for [ and digits/commas inside quotes or right after values
        jsonStr = jsonStr.replace(/\[\s*\d+[\s,\d]*\s*\]/g, "");
        
        // 4. Final attempt to parse
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("JSON Cleaning failed", e, text);
        return null;
    }
};

export const fetchBeverageInfo = async (query: string) => {
  const ai = getAI();
  return await retryWrapper(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Investiga la ficha técnica real de: "${query}". 
        Responde ÚNICAMENTE con un objeto JSON plano que contenga: name, producer, variety, category, subcategory, country, region, abv (valor numérico sin %), vintage (año). 
        No añadidas explicaciones.`,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });
      
      const text = response.text || "";
      const data = cleanGroundedJson(text);
      
      if (!data || Object.keys(data).length < 2) {
          throw new Error("No se pudo extraer información estructurada.");
      }
      return data;
  });
};

export const generateBeverageImage = async (options: { prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" }) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `Professional product photography of ${options.prompt}. High resolution, studio lighting, elegant.` }] },
    config: { imageConfig: { aspectRatio: options.aspectRatio } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("No se generó imagen.");
};

export const analyzeLabelFromImage = async (imageBase64: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: [
      { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(imageBase64) } },
      { text: `Extrae los datos técnicos en JSON: name, producer, variety, category, subcategory, country, region, abv, vintage.` }
    ],
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{}");
};

export const initChatWithEauxDeVie = (inventorySummary?: string) => {
  const ai = getAI();
  let systemInstruction = `Eres "Eaux-de-Vie", Sommelier IA experto de KataList. Ayudas con maridajes y dudas técnicas de forma elegante.`;
  if (inventorySummary) systemInstruction += `\n\nContexto de bodega:\n${inventorySummary.substring(0, 500)}`;
  return ai.chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction } });
};

export const initGuidedTastingChat = () => {
  const ai = getAI();
  return ai.chats.create({ 
    model: 'gemini-3-flash-preview', 
    config: { systemInstruction: "Guía al usuario en una cata profesional. Al final genera un JSON con los resultados." } 
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
        contents: `Normaliza estas etiquetas: ${JSON.stringify(tags)}. Devuelve array de {original, corrected}.`,
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
        contents: `Escribe nota de cata para: ${data.name}. Etiquetas: ${data.tags.join(', ')}. Máximo 60 palabras.`,
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
  throw new Error("Fallo al editar.");
};
