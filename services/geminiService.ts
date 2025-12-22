
import { GoogleGenAI, Type, Schema } from "@google/genai";

const getAI = () => {
  let key = process.env.API_KEY || '';
  
  // SANITIZATION: Remove quotes and whitespace
  key = key.replace(/["']/g, '').trim();

  if (!key || key === 'undefined' || key === '') {
    throw new Error("Falta la API Key. Configúrala en Vercel como 'API_KEY'.");
  }

  return new GoogleGenAI({ apiKey: key });
};

// Helper to convert Base64 to standard format if needed
const cleanBase64 = (b64: string) => b64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

// --- RETRY LOGIC (Exponential Backoff) ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWrapper<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        // Retry on 429 (Too Many Requests) or 503 (Service Unavailable)
        if (retries > 0 && (error.status === 429 || error.status === 503 || error.message?.includes('429') || error.message?.includes('503'))) {
            console.warn(`Gemini busy, retrying in ${delay}ms... (${retries} left)`);
            await wait(delay);
            return retryWrapper(operation, retries - 1, delay * 2);
        }
        throw error;
    }
}

/**
 * Initialize Chat with Eaux-de-Vie Persona
 */
export const initChatWithEauxDeVie = (inventorySummary?: string) => {
  const ai = getAI();
  let systemInstruction = `Eres "Eaux-de-Vie", un Sommelier IA experto, sofisticado, elegante pero accesible.
      Tu misión es ayudar a los usuarios de la app "KataList" a entender mejor sus bebidas, sugerir maridajes y educar sobre el mundo del vino, destilados y cerveza.
      
      Reglas de personalidad:
      1. Tono: Profesional, apasionado, cálido y culto.
      2. Idioma: Español fluido.
      3. Respuestas: Concisas pero informativas. Usa listas (bullet points) cuando sugieras maridajes. Usa Markdown para formatear negritas y listas.
      4. Conocimiento: Eres experto en análisis sensorial (vista, olfato, gusto).
      
      Si te preguntan quién eres, preséntate como "Eaux-de-Vie, tu sommelier personal en KataList".`;

  if (inventorySummary) {
      systemInstruction += `\n\nCONTEXTO GENERAL DE BODEGA:\n${inventorySummary.substring(0, 1000)}... (Resumen)`;
  }

  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction }
  });
};

/**
 * Initialize Guided Tasting Chat (Interview Mode)
 */
export const initGuidedTastingChat = () => {
  const ai = getAI();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `Eres un experto sommelier que realiza una entrevista guiada para crear una ficha de cata.
      Tu objetivo es hacer preguntas una por una al usuario para recopilar información sobre la bebida que está probando.
      
      Información necesaria:
      1. Nombre de la bebida
      2. Categoría (Vino, Cerveza, Whisky, etc.)
      3. Subcategoría (si aplica)
      4. País / Región
      5. ABV (Graduación alcohólica)
      6. Notas visuales (color, apariencia)
      7. Notas olfativas (aroma)
      8. Notas gustativas (sabor, cuerpo, final)
      
      Cuando hayas recopilado suficiente información, GENERA UN BLOQUE JSON al final de tu respuesta con el siguiente formato:
      \`\`\`json
      {
        "name": "...",
        "producer": "...",
        "variety": "...",
        "category": "...",
        "subcategory": "...",
        "country": "...",
        "region": "...",
        "abv": "...",
        "visual": "...",
        "aroma": "...",
        "taste": "...",
        "notes": "...",
        "vintage": "..."
      }
      \`\`\`
      
      No inventes datos si el usuario no los sabe, déjalos en blanco o pon "N/A".`,
    }
  });
};

/**
 * Analyze Label Image (OCR/Vision)
 */
export const analyzeLabelFromImage = async (imageBase64: string) => {
  const ai = getAI();
  
  const labelSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Nombre completo de la bebida" },
      producer: { type: Type.STRING, description: "Nombre de la Bodega o Productor" },
      variety: { type: Type.STRING, description: "Variedad de uva o materia prima" },
      category: { type: Type.STRING, description: "Categoría general" },
      subcategory: { type: Type.STRING, description: "Tipo específico" },
      country: { type: Type.STRING, description: "País de origen" },
      region: { type: Type.STRING, description: "Región" },
      abv: { type: Type.STRING, description: "Graduación" },
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
              { text: `Analiza esta etiqueta y extrae los datos técnicos en ESPAÑOL.` }
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
 * Auto-complete beverage details using Search Grounding
 */
export const fetchBeverageInfo = async (query: string) => {
  const ai = getAI();
  
  try {
    return await retryWrapper(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Información técnica detallada sobre la bebida "${query}". Devuelve JSON en ESPAÑOL.`,
          config: {
            tools: [{ googleSearch: {} }],
          }
        });
        
        let text = response.text || "{}";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) text = jsonMatch[0];
        return JSON.parse(text);
    });
  } catch (error) {
    console.error("Error fetching beverage info:", error);
    throw error;
  }
};

/**
 * Suggest Subcategories
 */
export const suggestSubcategories = async (categoryName: string): Promise<string[]> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Para la categoría "${categoryName}", lista 5 subcategorías comunes. Devuelve JSON array de strings.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [];
  }
};

/**
 * Optimize Tag List
 */
export const optimizeTagList = async (tags: string[]): Promise<{ original: string, corrected: string }[]> => {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: `Corrige acentos y unifica duplicados en estas etiquetas: ${JSON.stringify(tags)}. Devuelve JSON con lista de correcciones {original, corrected}.`,
            config: { responseMimeType: 'application/json' }
        });
        const data = JSON.parse(response.text || "{}");
        return data.corrections || [];
    } catch (e) {
        return [];
    }
}

/**
 * Analyze free text notes
 */
export const analyzeTastingNotes = async (
    text: string, 
    category: string, 
    profileLabels: string[]
): Promise<{ tags: string[], profile?: any }> => {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analiza estas notas de cata para "${category}": "${text}". Extrae etiquetas de sabor en ESPAÑOL y perfil 1-5 para: ${profileLabels.join(',')}. Devuelve JSON.`,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || "{}");
    } catch (error) {
        return { tags: [] };
    }
};

/**
 * Generate Review from Tags
 */
export const generateReviewFromTags = async (data: any) => {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Escribe una nota de cata breve (60 palabras) para: ${data.name} (${data.category}). Etiquetas: ${data.tags.join(', ')}. En primera persona, poético pero técnico.`,
        });
        return response.text?.trim() || "";
    } catch (error) {
        throw error;
    }
};

/**
 * Generate Image
 */
export interface GenImageOptions {
  prompt: string;
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
}

export const generateBeverageImage = async (options: GenImageOptions) => {
  const ai = getAI();
  try {
    // Usamos gemini-2.5-flash-image tal como pide la documentación
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `High quality studio photograph of a beverage bottle: ${options.prompt}. Professional lighting, 4k, realistic texture.` }] },
      config: {
          imageConfig: { aspectRatio: options.aspectRatio }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    throw new Error("El modelo no devolvió una imagen.");
  } catch (error: any) {
    console.error("Error generating image:", error);
    if (error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("Límite de la API alcanzado. La generación de imágenes es una función de alta demanda, intenta de nuevo en unos minutos.");
    }
    if (error.message?.includes('safety')) {
        throw new Error("La IA bloqueó el prompt por políticas de seguridad. Intenta con un nombre más genérico.");
    }
    throw new Error("Error de conexión con el generador de imágenes. Revisa tu API Key.");
  }
};

/**
 * Edit Image
 */
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
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No se pudo editar la imagen.");
  } catch (error: any) {
    throw error;
  }
};
