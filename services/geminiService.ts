
import { GoogleGenAI, Type, Schema } from "@google/genai";

const getAI = () => {
  let key = process.env.API_KEY || '';
  key = key.replace(/["']/g, '').trim();
  if (!key || key === 'undefined') {
    throw new Error("Falta la API Key.");
  }
  return new GoogleGenAI({ apiKey: key });
};

const cleanBase64 = (b64: string) => b64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

export interface TagCorrection {
  original: string;
  corrected: string;
}

export interface BeverageData {
  name: string;
  producer?: string;
  variety?: string;
  category: string;
  subcategory?: string;
  country?: string;
  region?: string;
  abv?: string;
  vintage?: string;
}

/**
 * Initialize Chat with Eaux-de-Vie Persona
 */
export const initChatWithEauxDeVie = (inventorySummary?: string) => {
  const ai = getAI();
  let systemInstruction = `Eres "Eaux-de-Vie", un Sommelier IA experto. Ayuda a los usuarios de "KataList" con maridajes y dudas técnicas.`;
  if (inventorySummary) systemInstruction += `\n\nResumen de bodega: ${inventorySummary.substring(0, 500)}`;

  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction }
  });
};

/**
 * Fix: Added missing initGuidedTastingChat export used in AIViews.tsx
 * Initialize Guided Tasting Chat
 */
export const initGuidedTastingChat = () => {
  const ai = getAI();
  const systemInstruction = `Eres un Sommelier experto guiando una cata profesional paso a paso (Fase Visual, Olfativa, Gustativa).
  Al finalizar la guía, DEBES generar un resumen técnico en formato JSON estricto dentro de un bloque de código markdown.
  Formato del JSON:
  {
    "name": "string",
    "producer": "string",
    "variety": "string",
    "category": "string",
    "subcategory": "string",
    "country": "string",
    "region": "string",
    "abv": "string",
    "vintage": "string",
    "visual": "string",
    "aroma": "string",
    "taste": "string",
    "notes": "string"
  }`;

  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction }
  });
};

/**
 * Auto-complete beverage details using Search Grounding
 */
export const fetchBeverageInfo = async (query: string): Promise<{ data: BeverageData, sources: any[] }> => {
  const ai = getAI();
  // Fix: guidelines state that JSON response schema might not be compatible with googleSearch grounding.
  // We remove responseMimeType and use manual JSON extraction from the grounded response.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extrae la ficha técnica completa en formato JSON de: "${query}". El JSON debe contener las propiedades name, producer, variety, category, subcategory, country, region, abv, vintage.`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const text = response.text || "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const data = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return { data, sources };
};

/**
 * Analyze Label Image
 */
export const analyzeLabelFromImage = async (imageBase64: string): Promise<BeverageData> => {
  const ai = getAI();
  const labelSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      producer: { type: Type.STRING },
      category: { type: Type.STRING },
      subcategory: { type: Type.STRING },
      country: { type: Type.STRING },
      region: { type: Type.STRING },
      abv: { type: Type.STRING },
      vintage: { type: Type.STRING }
    },
    required: ["name", "category"]
  };

  // Fix: Use correct model name 'gemini-flash-lite-latest' for Lite tasks as per guidelines
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(imageBase64) } },
        { text: "Analiza esta etiqueta." }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: labelSchema
    }
  });
  return JSON.parse(response.text || "{}");
};

/**
 * Optimize Tag List
 */
export const optimizeTagList = async (tags: string[]): Promise<TagCorrection[]> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Unifica y corrige ortografía de estas etiquetas: ${JSON.stringify(tags)}.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              original: { type: Type.STRING },
              corrected: { type: Type.STRING }
            },
            required: ["original", "corrected"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};

export const generateReviewFromTags = async (data: any): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Escribe nota de cata para: ${data.name}. Tags: ${data.tags.join(', ')}.`,
  });
  return response.text?.trim() || "";
};

export const generateBeverageImage = async (options: { prompt: string, aspectRatio: string }): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `Photograph of ${options.prompt}` }] },
    config: { imageConfig: { aspectRatio: options.aspectRatio as any } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("No image returned");
};

export const editBeverageImage = async (imageBase64: string, instruction: string): Promise<string> => {
  const ai = getAI();
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
  throw new Error("Edit failed");
};

export const suggestSubcategories = async (categoryName: string): Promise<string[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Subcategorías para ${categoryName}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const analyzeTastingNotes = async (text: string, category: string, profileLabels: string[]): Promise<any> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analiza: "${text}". Categoría: "${category}". Extrae tags y perfil 1-5 para ${profileLabels.join(',')}.`,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{}");
};
