// /services/ia.service.ts
import { OpenAI } from "openai";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env";

let openai: any;
let model: any;

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

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

export async function generateStory(
  title: string,
  characterName: string,
  environment: string,
  theme: string,
  objetive: string
): Promise<any> {
  const prompt = `Actúa como un autor de cuentos infantiles interactivos. Debes generar:

Datos base:
- Título: ${title}
- Personaje principal: ${characterName} (id: 'main_character')
- Escenario principal: ${environment} (id: 'main_environment')
- Tema: ${theme}
- Objetivo: ${objetive}

Requisitos:
Todas las historias deben ser en español
1. INCLUIR TODOS los personajes que aparecen en el array 'characters'
2. Cada personaje debe tener id único, name y prompt
3. Cada escena debe incluir:
   - sceneCharacters: IDs de personajes presentes
   - sceneEnvironment: ID del entorno
   - imagePrompt: Descripción visual
   - options: Solo para escenas no finales
 4. Nodo de inicio con introducción y 2 opciones.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          theme: { type: "string" },
          characters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                prompt: { type: "string" },
              },
              required: ["id", "name", "prompt"],
            },
          },
          environments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                prompt: { type: "string" },
              },
              required: ["id", "name", "prompt"],
            },
          },
          scenes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                content: { type: "string" },
                sceneCharacters: {
                  type: "array",
                  items: { type: "string" },
                },
                sceneEnvironment: { type: "string" },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      nextSceneId: { type: "string" },
                    },
                  },
                },
                imagePrompt: { type: "string" },
              },
              required: [
                "id",
                "type",
                "content",
                "sceneCharacters",
                "sceneEnvironment",
                "imagePrompt"
              ],
            },
          },
        },
        required: [
          "id",
          "title",
          "theme",
          "characters",
          "environments",
          "scenes"
        ],
      },
    },
  });

  return JSON.parse(response.text ?? "{}");
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
