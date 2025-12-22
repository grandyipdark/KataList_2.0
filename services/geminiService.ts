
import { GoogleGenAI, Type, Schema } from "@google/genai";

const getAI = () => {
  let key = process.env.API_KEY || '';
  key = key.replace(/["']/g, '').trim();
  if (!key || key === 'undefined' || key === '') {
    throw new Error("Falta la API Key en las variables de entorno.");
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
  visual?: string;
  aroma?: string;
  taste?: string;
  notes?: string;
}

/**
 * Eaux-de-Vie Sommelier Chat Initialization
 */
export const initChatWithEauxDeVie = (inventorySummary?: string) => {
  const ai = getAI();
  let systemInstruction = `Eres "Eaux-de-Vie", un Sommelier IA sofisticado y culto. 
  Ayudas a los usuarios de "KataList" con maridajes, dudas técnicas y educación sensorial. 
  Hablas español de forma elegante y profesional.`;
  
  if (inventorySummary) {
    systemInstruction += `\n\nResumen de la bodega del usuario para contexto:\n${inventorySummary.substring(0, 500)}`;
  }

  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction }
  });
};

/**
 * Guided Tasting Interview Chat
 */
export const initGuidedTastingChat = () => {
  const ai = getAI();
  const systemInstruction = `Eres un Sommelier experto guiando una cata profesional paso a paso.
  Entrevistas al usuario sobre las fases visual, olfativa y gustativa.
  Al final, DEBES generar un bloque de código JSON con los resultados.
  Formato JSON:
  {
    "name": "Nombre",
    "producer": "Marca",
    "category": "Vino/Cerveza/Destilado",
    "subcategory": "Estilo",
    "country": "País",
    "region": "Región",
    "abv": "Grado",
    "vintage": "Añada",
    "visual": "Descripción visual",
    "aroma": "Descripción aroma",
    "taste": "Descripción gusto",
    "notes": "Conclusiones"
  }`;

  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction }
  });
};

/**
 * Fetch beverage technical details using Google Search Grounding
 */
export const fetchBeverageInfo = async (query: string): Promise<{ data: BeverageData, sources: any[] }> => {
  const ai = getAI();
  
  // Rule: When using googleSearch, responseMimeType: "application/json" is often unreliable 
  // or blocked. We ask for a clear JSON block in plain text and extract it.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Investiga la ficha técnica de: "${query}".
    Responde ÚNICAMENTE con un objeto JSON dentro de un bloque de código markdown con estos campos exactos:
    name, producer, variety, category, subcategory, country, region, abv, vintage.
    Si no encuentras un dato, pon cadena vacía.`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const text = response.text || "";
  let data: BeverageData = { name: query, category: 'Vino' };
  
  try {
    // Look for JSON block regardless of surrounding text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      data = { ...data, ...parsed };
    } else if (text.trim().startsWith('{')) {
      data = { ...data, ...JSON.parse(text) };
    }
  } catch (e) {
    console.warn("Could not parse search response as JSON, using raw text fallback", e);
  }

  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return { data, sources };
};

/**
 * OCR and Technical Label Analysis from Image
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

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(imageBase64) } },
        { text: "Analiza la etiqueta de esta botella y extrae la ficha técnica en español." }
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
 * Optimization and normalization for tag clouds
 */
export const optimizeTagList = async (tags: string[]): Promise<TagCorrection[]> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Unifica duplicados por ortografía o sinónimos en esta lista: ${JSON.stringify(tags)}.
      Devuelve un array JSON de objetos {original, corrected}.`,
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

/**
 * AI Image Generation for beverage listings
 */
export const generateBeverageImage = async (options: { prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" }): Promise<string> => {
  const ai = getAI();
  
  // Rule: DO NOT set responseMimeType for image models.
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { 
      parts: [{ text: `Professional studio product photography of ${options.prompt}, elegant lighting, 4k, ultra-realistic, clear details.` }] 
    },
    config: { 
      imageConfig: { 
        aspectRatio: options.aspectRatio 
      } 
    }
  });

  // Iterate to find the actual image part
  const candidates = response.candidates || [];
  if (candidates.length > 0) {
    const parts = candidates[0].content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  
  throw new Error("No se encontró ninguna imagen en la respuesta de la IA.");
};

/**
 * AI Image Editing using instructions
 */
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

  const candidates = response.candidates || [];
  if (candidates.length > 0) {
    const parts = candidates[0].content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  throw new Error("La edición falló.");
};

/**
 * Suggest subcategories for a given category
 */
export const suggestSubcategories = async (categoryName: string): Promise<string[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Sugiere 5 subcategorías populares para: "${categoryName}". Solo array JSON de strings.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    }
  });
  return JSON.parse(response.text || "[]");
};

/**
 * Extract tags and profile from narrative tasting notes
 */
export const analyzeTastingNotes = async (text: string, category: string, profileLabels: string[]): Promise<any> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analiza: "${text}". Categoría: "${category}". 
    Extrae etiquetas y asigna valores 1-5 para: ${profileLabels.join(', ')}. Responde en JSON.`,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{}");
};

export const generateReviewFromTags = async (data: any): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Escribe una nota de cata elegante para: ${data.name}. 
    Características: ${data.tags.join(', ')}.`,
  });
  return response.text?.trim() || "Sin reseña generada.";
};
