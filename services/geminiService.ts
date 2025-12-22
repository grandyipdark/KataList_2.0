
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
  
  // Note: Search grounding often returns text + citations. We ask for a clear JSON block.
  // We avoid 'responseMimeType: application/json' here because search models sometimes prepend text.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Search technical data for: "${query}".
    Return a JSON object with these fields: name, producer, variety, category, subcategory, country, region, abv, vintage.
    Important: Respond with the JSON object only.`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const text = response.text || "";
  let data: BeverageData = { name: query, category: 'Vino' };
  
  try {
    // Advanced Regex to find the JSON block inside potentially complex search responses
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      data = { ...data, ...parsed };
    }
  } catch (e) {
    console.error("Critical: Failed to parse search grounding result", e);
    throw new Error("No se pudo procesar la información de búsqueda.");
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
        { text: "Analyze this label and extract technical sheet in Spanish." }
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
      contents: `Normalize these tasting tags: ${JSON.stringify(tags)}. Unify spelling/synonyms. 
      Return an array of {original, corrected}.`,
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
  
  // Prohibited: responseMimeType for image models.
  // Prompt optimized for high quality catalog look.
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ 
      parts: [{ text: `A professional commercial photograph of ${options.prompt}. Elegant studio lighting, clean background, 4k resolution, ultra-realistic.` }] 
    }],
    config: { 
      imageConfig: { 
        aspectRatio: options.aspectRatio 
      } 
    }
  });

  const candidate = response.candidates?.[0];
  if (candidate && candidate.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  
  throw new Error("La IA no generó una imagen válida.");
};

/**
 * AI Image Editing using instructions
 */
export const editBeverageImage = async (imageBase64: string, instruction: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{
      parts: [
        { inlineData: { mimeType: 'image/png', data: cleanBase64(imageBase64) } },
        { text: instruction }
      ]
    }]
  });

  const candidate = response.candidates?.[0];
  if (candidate && candidate.content?.parts) {
    for (const part of candidate.content.parts) {
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
    contents: `Suggest 5 subcategories for beverage category: "${categoryName}". Return JSON array of strings.`,
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
    contents: `Analyze these tasting notes: "${text}". Category: "${category}". 
    Extract flavor tags and assign values 1-5 for these profiles: ${profileLabels.join(', ')}. Respond with JSON object.`,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{}");
};

export const generateReviewFromTags = async (data: any): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write an elegant tasting review for: ${data.name}. 
    Based on these tags: ${data.tags.join(', ')}. Keep it in Spanish.`,
  });
  return response.text?.trim() || "Reseña no disponible.";
};
