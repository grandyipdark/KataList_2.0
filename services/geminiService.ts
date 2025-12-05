
import { GoogleGenAI, Type, FunctionDeclaration, Schema } from "@google/genai";

const getAI = () => {
  let key = process.env.API_KEY || '';
  
  // SANITIZATION: Remove quotes and whitespace
  key = key.replace(/["']/g, '').trim();

  if (!key || key === 'undefined' || key === '') {
    throw new Error("Falta la API Key. Configúrala en Vercel como 'API_KEY'.");
  }

  // VALIDATION: Check if it looks like a Client ID (starts with numbers)
  if (/^\d/.test(key)) {
      throw new Error("Error de Configuración: Has puesto un 'Client ID' (empieza por números) en lugar de una 'API Key'. La clave correcta debe empezar por 'AIza'. Consíguela en aistudio.google.com");
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
        
        // Handle Invalid API Key explicitly
        if (error.status === 400 && error.message?.includes('API key not valid')) {
             throw new Error("API Key rechazada por Google. Verifica que sea válida y empiece por 'AIza'.");
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
    model: 'gemini-2.5-flash',
    config: { systemInstruction }
  });
};

/**
 * Initialize Guided Tasting Chat (Interview Mode)
 */
export const initGuidedTastingChat = () => {
  const ai = getAI();
  return ai.chats.create({
    model: 'gemini-2.5-flash',
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
      
      Comienza saludando y preguntando qué está bebiendo.
      Haz preguntas cortas y amables.
      
      Cuando hayas recopilado suficiente información, GENERA UN BLOQUE JSON al final de tu respuesta con el siguiente formato, encerrado en tres backticks y con la etiqueta json:
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
 * Analyze Label Image (OCR/Vision) - STRICT SCHEMA
 */
export const analyzeLabelFromImage = async (imageBase64: string) => {
  const ai = getAI();
  
  const labelSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Nombre completo de la bebida" },
      producer: { type: Type.STRING, description: "Nombre de la Bodega, Destilería o Productor" },
      variety: { type: Type.STRING, description: "Variedad de uva o materia prima" },
      category: { type: Type.STRING, description: "Categoría general (Vino, Cerveza, Whisky, Ron, Gin, etc)" },
      subcategory: { type: Type.STRING, description: "Tipo específico (ej: Rioja, IPA, Single Malt)" },
      country: { type: Type.STRING, description: "País de origen en Español" },
      region: { type: Type.STRING, description: "Región o Denominación de Origen" },
      abv: { type: Type.STRING, description: "Graduación alcohólica (solo el número, ej '13.5')" },
      vintage: { type: Type.STRING, description: "Año de cosecha (si aplica)" }
    },
    required: ["name", "category"]
  };

  try {
    return await retryWrapper(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(imageBase64) } },
              { text: `Analiza esta etiqueta de bebida. Extrae la información técnica. Traduce los valores al ESPAÑOL.` }
            ]
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: labelSchema
          }
        });
        const text = response.text || "{}";
        return JSON.parse(text);
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
          model: 'gemini-2.5-flash',
          contents: `Busca información técnica detallada sobre la bebida "${query}".
          
          Devuelve SOLAMENTE un JSON válido con esta estructura, sin texto introductorio ni markdown:
          {
            "name": "Nombre oficial",
            "producer": "Productor",
            "variety": "Variedad",
            "category": "Categoría",
            "subcategory": "Subcategoría",
            "country": "País",
            "region": "Región",
            "abv": "ABV",
            "visual": "Notas visuales",
            "aroma": "Notas de aroma",
            "taste": "Notas de sabor",
            "description": "Breve descripción"
          }
          
          Responde SIEMPRE en ESPAÑOL.`,
          config: {
            tools: [{ googleSearch: {} }],
          }
        });
        
        let text = response.text || "{}";
        
        // Remove markdown block symbols
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Safety: Extract the first JSON object found if there's extra conversational text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

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
    return await retryWrapper(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash', 
          contents: `For the beverage category "${categoryName}", list 5 common subcategories or styles in English.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
          }
        });
        let text = response.text || "[]";
        return JSON.parse(text);
    });
  } catch (error) {
    console.error("Error suggesting subcategories:", error);
    return [];
  }
};

/**
 * Optimize Tag List
 */
export const optimizeTagList = async (tags: string[]): Promise<{ original: string, corrected: string }[]> => {
    const ai = getAI();
    const uniqueTags = Array.from(new Set(tags));
    
    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            corrections: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        original: { type: Type.STRING },
                        corrected: { type: Type.STRING }
                    }
                }
            }
        }
    };

    try {
        return await retryWrapper(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', 
                contents: `Analiza la lista de etiquetas: ${JSON.stringify(uniqueTags)}.
                Genera correcciones para: Acentos, Title Case y Plurales.
                Devuelve JSON.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            });
            const text = response.text || "{}";
            const data = JSON.parse(text);
            return data.corrections || [];
        });
    } catch (e) {
        return [];
    }
}

/**
 * Analyze free text notes - STRICT SCHEMA
 */
export const analyzeTastingNotes = async (
    text: string, 
    category: string, 
    profileLabels: string[]
): Promise<{ tags: string[], profile?: any }> => {
    const ai = getAI();
    
    const analysisSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            tags: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Lista de 5-8 etiquetas de sabor descriptivas EN ESPAÑOL, normalizadas en Title Case (ej: 'Frutos Rojos', 'Madera', 'Cítrico', 'Vainilla')."
            },
            profile: {
                type: Type.OBJECT,
                properties: {
                    p1: { type: Type.NUMBER, description: `Nivel de 1-5 para ${profileLabels[0]}` },
                    p2: { type: Type.NUMBER, description: `Nivel de 1-5 para ${profileLabels[1]}` },
                    p3: { type: Type.NUMBER, description: `Nivel de 1-5 para ${profileLabels[2]}` },
                    p4: { type: Type.NUMBER, description: `Nivel de 1-5 para ${profileLabels[3]}` },
                    p5: { type: Type.NUMBER, description: `Nivel de 1-5 para ${profileLabels[4]}` }
                },
                required: ["p1", "p2", "p3", "p4", "p5"]
            }
        },
        required: ["tags", "profile"]
    };

    try {
        return await retryWrapper(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Analiza las siguientes notas de cata para la bebida categoría "${category}": "${text}". 
                Tu tarea es extraer etiquetas (tags) de sabor/aroma y estimar el perfil numérico.
                IMPORTANTE: Las etiquetas deben estar ESTRICTAMENTE EN ESPAÑOL.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: analysisSchema
                }
            });
            return JSON.parse(response.text || "{}");
        });
    } catch (error) {
        console.error("Error analyzing notes:", error);
        return { tags: [] };
    }
};

/**
 * Generate Review from Tags (Reverse AI)
 */
export const generateReviewFromTags = async (data: any) => {
    const ai = getAI();
    const { name, category, subcategory, tags, profile, score } = data;
    
    try {
        return await retryWrapper(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Actúa como un sommelier experto y escribe una nota de cata breve, poética y evocadora (máximo 60 palabras) para esta bebida:
                - Nombre: ${name}
                - Tipo: ${category} ${subcategory}
                - Etiquetas de sabor: ${tags.join(', ')}
                - Perfil estructural (1-5): ${JSON.stringify(profile)}
                - Puntuación: ${score}/10
                
                Escribe en PRIMERA PERSONA ("En nariz percibo...", "En boca es..."). Sé creativo pero coherente con los datos.`,
            });
            return response.text?.trim() || "";
        });
    } catch (error) {
        console.error("Error generating review:", error);
        throw error;
    }
};

/**
 * Generate Image
 */
export interface GenImageOptions {
  prompt: string;
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  size?: "1K" | "2K" | "4K";
}

export const generateBeverageImage = async (options: GenImageOptions) => {
  const ai = getAI();
  try {
    const model = 'gemini-2.5-flash-image'; 
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: options.prompt }] },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No se generó ninguna imagen.");
  } catch (error: any) {
    console.error("Error generating image:", error);
    // Parse Google Quota Error
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("Has alcanzado el límite de imágenes del plan gratuito. Intenta más tarde o revisa tu cuenta de Google.");
    }
    throw error;
  }
};

/**
 * Edit Image
 */
export const editBeverageImage = async (imageBase64: string, instruction: string) => {
  const ai = getAI();
  try {
    const model = 'gemini-2.5-flash-image';
    const response = await ai.models.generateContent({
      model: model,
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
    console.error("Error editing image:", error);
    // Parse Google Quota Error
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("Has alcanzado el límite de imágenes del plan gratuito. Intenta más tarde.");
    }
    throw error;
  }
};
