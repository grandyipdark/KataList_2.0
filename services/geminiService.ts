
import { GoogleGenAI, Type, Schema } from "@google/genai";

const getAI = () => {
  let key = process.env.API_KEY || '';
  key = key.replace(/["']/g, '').trim();
<<<<<<< HEAD
  if (!key || key === 'undefined') {
    throw new Error("Falta la API Key.");
  }
=======

  if (!key || key === 'undefined' || key === '') {
    throw new Error("Falta la API Key. Configúrala en el entorno.");
  }

>>>>>>> a887488ca45449a1de44afa1c7046ba750e00eed
  return new GoogleGenAI({ apiKey: key });
};

const cleanBase64 = (b64: string) => b64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

export interface TagCorrection {
  original: string;
  corrected: string;
}

<<<<<<< HEAD
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
=======
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
>>>>>>> a887488ca45449a1de44afa1c7046ba750e00eed
}

/**
 * Initialize Chat with Eaux-de-Vie Persona
 */
export const initChatWithEauxDeVie = (inventorySummary?: string) => {
  const ai = getAI();
<<<<<<< HEAD
  let systemInstruction = `Eres "Eaux-de-Vie", un Sommelier IA experto. Ayuda a los usuarios de "KataList" con maridajes y dudas técnicas.`;
  if (inventorySummary) systemInstruction += `\n\nResumen de bodega: ${inventorySummary.substring(0, 500)}`;
=======
  let systemInstruction = `Eres "Eaux-de-Vie", un Sommelier IA experto, sofisticado, elegante pero accesible.
      Tu misión es ayudar a los usuarios de la app "KataList" a entender mejor sus bebidas, sugerir maridajes y educar sobre el mundo del vino, destilados y cerveza.
      
      Reglas de personalidad:
      1. Tono: Profesional, apasionado, cálido y culto.
      2. Idioma: Español fluido.
      3. Respuestas: Concisas pero informativas. Usa listas. Usa Markdown.
      4. Conocimiento: Eres experto en análisis sensorial.`;

  if (inventorySummary) {
      systemInstruction += `\n\nCONTEXTO GENERAL DE BODEGA:\n${inventorySummary.substring(0, 1000)}... (Resumen)`;
  }
>>>>>>> a887488ca45449a1de44afa1c7046ba750e00eed

  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction }
  });
};

/**
<<<<<<< HEAD
 * Fix: Added missing initGuidedTastingChat export used in AIViews.tsx
=======
>>>>>>> a887488ca45449a1de44afa1c7046ba750e00eed
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
<<<<<<< HEAD
    config: { systemInstruction }
=======
    config: {
      systemInstruction: `Eres un experto sommelier que realiza una entrevista guiada. Recopila: nombre, categoría, subcategoría, país, región, ABV, notas visuales, olfativas y gustativas. Al final genera un bloque JSON.`,
    }
>>>>>>> a887488ca45449a1de44afa1c7046ba750e00eed
  });
};

/**
<<<<<<< HEAD
=======
 * Analyze Label Image (OCR/Vision)
 */
export const analyzeLabelFromImage = async (imageBase64: string) => {
  const ai = getAI();
  
  const labelSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Nombre completo de la bebida" },
      producer: { type: Type.STRING, description: "Marca/Productor" },
      variety: { type: Type.STRING, description: "Variedad principal" },
      category: { type: Type.STRING, description: "Categoría general" },
      subcategory: { type: Type.STRING, description: "Estilo específico" },
      country: { type: Type.STRING, description: "País" },
      region: { type: Type.STRING, description: "Región" },
      abv: { type: Type.STRING, description: "Graduación (solo número)" },
      vintage: { type: Type.STRING, description: "Año" }
    },
    required: ["name", "category"]
  };

  try {
    return await retryWrapper(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-lite-latest',
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(imageBase64) } },
              { text: `Analiza esta etiqueta y extrae datos técnicos en ESPAÑOL.` }
            ]
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: labelSchema
          }
        });
        return JSON.parse(response.text || "{}");
    });
  } catch (error) {
    console.error("Error analyzing label:", error);
    throw error;
  }
};

/**
>>>>>>> a887488ca45449a1de44afa1c7046ba750e00eed
 * Auto-complete beverage details using Search Grounding
 */
export const fetchBeverageInfo = async (query: string): Promise<{ data: BeverageData, sources: any[] }> => {
  const ai = getAI();
<<<<<<< HEAD
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
=======
  
  const beverageSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      producer: { type: Type.STRING },
      variety: { type: Type.STRING },
      category: { type: Type.STRING },
      subcategory: { type: Type.STRING },
      country: { type: Type.STRING },
      region: { type: Type.STRING },
      abv: { type: Type.STRING },
      vintage: { type: Type.STRING }
    },
    required: ["name", "category"]
  };

  try {
    return await retryWrapper(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Investiga y extrae la ficha técnica oficial de la bebida: "${query}".`,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json',
            responseSchema: beverageSchema
          }
        });
        
        const data = JSON.parse(response.text || "{}");
        // Extract grounding sources as required by rules
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = chunks
            .map((c: any) => ({ uri: c.web?.uri, title: c.web?.title }))
            .filter((s: any) => s.uri);

        return { data, sources };
    });
  } catch (error) {
    console.error("Error fetching beverage info:", error);
    throw error;
  }
};

export const suggestSubcategories = async (categoryName: string): Promise<string[]> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Para "${categoryName}", lista 5 subcategorías comunes. JSON array.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) { return []; }
};

export const optimizeTagList = async (tags: string[]) => {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: `Corrige y unifica estas etiquetas: ${JSON.stringify(tags)}. Devuelve JSON {corrections: [{original, corrected}]}.`,
            config: { responseMimeType: 'application/json' }
        });
        const data = JSON.parse(response.text || "{}");
        return data.corrections || [];
    } catch (e) { return []; }
}

export const analyzeTastingNotes = async (text: string, category: string, profileLabels: string[]) => {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analiza: "${text}". Categoría: "${category}". Extrae tags y perfil 1-5 para ${profileLabels.join(',')}. JSON.`,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || "{}");
    } catch (error) { return { tags: [] }; }
};

export const generateReviewFromTags = async (data: any) => {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Escribe nota de cata para: ${data.name} (${data.category}). Tags: ${data.tags.join(', ')}.`,
        });
        return response.text?.trim() || "";
    } catch (error) { throw error; }
};

export interface GenImageOptions {
  prompt: string;
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
}

export const generateBeverageImage = async (options: GenImageOptions) => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `Professional studio photo of ${options.prompt}. Realistic, 4k.` }] },
      config: { imageConfig: { aspectRatio: options.aspectRatio } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image returned");
  } catch (error: any) { throw error; }
};

export const editBeverageImage = async (imageBase64: string, instruction: string) => {
  const ai = getAI();
  try {
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
  } catch (error: any) { throw error; }
>>>>>>> a887488ca45449a1de44afa1c7046ba750e00eed
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
