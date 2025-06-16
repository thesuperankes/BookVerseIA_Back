// /services/ia.service.ts
import { OpenAI } from "openai";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env";

let openai: any;
let model: any;

const ai = new GoogleGenAI({ apiKey: "AIzaSyDkD6c8ZKabwk0l5dTUQGUqkqW5BVPTRBc" });

if (env.USEDEEPSEEK === "true") {
  console.log("Usando DeepSeek como proveedor de IA");
  openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: env.DEEPSEEK_API_KEY,
  });
  model = "deepseek-chat";
} else {
  console.log("Usando ChatGPT como proveedor de IA");
  openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
  model = "gpt-4o";
}



export async function generateRecommendations(sinopsis: string): Promise<string> {
  const prompt = `Dame 6 recomendaciones clave para construir un cuento infantil basado en esta sinopsis: "${sinopsis}". Incluye tono, estilo, longitud, vocabulario y temas sensibles a evitar.`;

  const res = await chatRequest("Eres un editor experto de cuentos infantiles.", prompt);
  return res;
}

export async function generateStoryElements(sinopsis: string, recomendaciones: string): Promise<string> {
  const prompt = `Con base en esta sinopsis: "${sinopsis}" y estas recomendaciones: "${recomendaciones}", genera:
- Un título atractivo
- Nombre del personaje principal
- Descripción del personaje
- Escenario principal
- Conflicto central`;

  return await chatRequest("Eres un escritor de cuentos infantiles.", prompt);
}

export async function generateCharacterStickerDescription(nombre: string, descripcion: string): Promise<string> {
  const prompt = `Genera una descripción visual del personaje "${nombre}": ${descripcion}. El estilo debe ser amigable para niños y con elementos que funcionen bien como sticker.`;
  return await chatRequest("Eres un diseñador experto en stickers infantiles.", prompt);
}

export async function generateAct2(primerActo: string): Promise<string> {
  const prompt = `Continúa la historia a partir del siguiente primer acto: "${primerActo}". Escribe el segundo acto desarrollando el conflicto, con obstáculos para el personaje y manteniendo coherencia en tono y estilo.`;
  return await chatRequest("Eres un escritor de cuentos infantiles.", prompt);
}

export async function generateFinalAct(segundoActo: string): Promise<string> {
  const prompt = `Con base en el siguiente segundo acto: "${segundoActo}", escribe el desenlace del cuento resolviendo el conflicto de forma positiva y con una lección o moraleja.`;
  return await chatRequest("Eres un escritor de cuentos infantiles.", prompt);
}

export async function generateGamification(acts: string[]): Promise<string> {
  const fullStory = acts.join(" ");
  const prompt = `Con base en esta historia: "${fullStory}", crea actividades gamificadas para niños:
1. Pregunta de opción múltiple sobre el conflicto.
2. Juego de relación personaje-acción.
3. Actividad artística relacionada con el cuento.`;

  return await chatRequest("Eres un pedagogo especializado en cuentos infantiles y gamificación.", prompt);
}

export async function generateIntroduction(title: string, characterName:string,environment:string, theme:string,objetive:string): Promise<string> {
  const prompt = `Actúa como un autor de cuentos infantiles interactivos para niños de entre 6 y 10 años. Vas a generar una historia completa estilo "elige tu propia aventura", con múltiples escenas conectadas como un árbol de decisiones.

Datos base:
- Título de la historia: ${ title }
- Personaje principal: ${ characterName }
- Escenario principal: ${ environment }
- Tema o tono: ${ theme }
- Objetivo de la historia: ${ objetive }

Requisitos:
1. Usa lenguaje simple, frases breves y tono apropiado para niños.
2. Genera una historia ramificada en el siguiente formato:

Estructura esperada:
- Nodo de inicio con introducción y 2 opciones.
- Cada opción lleva a una escena intermedia.
- Cada escena intermedia lleva a un “giro” narrativo (puede usar elementos mágicos, personajes nuevos, descubrimientos, etc.)
- Cada giro lleva a una escena final (con cierre feliz o aprendizaje).
- Todas las escenas deben incluir texto, 2 decisiones (excepto finales), y una breve descripción visual para IA de imágenes.
`

;

const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config:{
      responseMimeType: "application/json",
      responseSchema:{
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            characterName: { type: Type.STRING },
            setting: { type: Type.STRING },
            theme: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING },
                  content: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        nextSceneId: { type: Type.STRING },
                      },
                      required: ["text", "nextSceneId"],
                    },
                  },
                  imagePrompt: { type: Type.STRING },
                },
                required: ["id", "type", "content", "imagePrompt"],
              },
            },
          },
          required: ["id", "title", "characterName", "setting", "theme", "scenes"],
      }
    }
  });


  return JSON.parse(response.text ?? '') || "";
}
async function chatRequest(system: string, userPrompt: string, temperature = 0.8, max_tokens = 800): Promise<string> {
  const res = await openai.chat.completions.create({
    model: model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    temperature,
    max_tokens,
  });

  return res.choices[0]?.message?.content || "";
}
