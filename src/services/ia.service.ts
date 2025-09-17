// /services/ia.service.ts
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env";
import type { ImageGenOptions, SceneForImage, SceneImageResult } from "../models/story.model";



const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function generateStory(
  title: string,
  characterName: string,
  environment: string,
  theme: string,
  objetive: string
): Promise<any> {

// Header estándar para consistencia visual de personajes en cada escena
const IMAGE_PROMPT_HEADER_TEMPLATE = `
[CHARACTER SHEET]
{{for each character in sceneCharacters}}
id: {{id}}
name: {{name}}
token: {{token}}            // identificador único estable (ej. "charTok:JAX-27")
hair: {{color/style/length}}
eyes: {{color/shape}}
skin: {{tone}}
outfit: {{top/bottom/accessories}}
palette: {{#RRGGBB, #RRGGBB, #RRGGBB}}   // 3–6 colores clave
silhouette: {{keywords}}                 // rasgos de forma/volumen
style: {{cel-shaded | painterly | flat-color | watercolor}}
proportions: {{cartoon | semi-realistic | realistic}}
do-not-change: hair color; eye color; outfit core; proportions
{{end}}

[STYLE PRESET]
global_style: {{tu_preset_global}}      // ej. "flat-color, líneas limpias"
camera: 35mm, medium shot, eye-level
lighting: soft, even
aspect: 4:3

[NEGATIVE RULES]
no new accessories; no hairstyle changes; no color drift; no extra characters; no text overlay

[SCENE PROMPT]
{{descripción breve de la acción, emociones, entorno}}
`;


  const prompt = `Actúa como un autor de cuentos infantiles interactivos. Debes generar:

Datos base:
- Título: ${title}
- Personaje principal: ${characterName} (id: 'main_character')
- Escenario principal: ${environment} (id: 'main_environment')
- Tema: ${theme}
- Objetivo: ${objetive}

Requisitos:
- Toda la historia en español.
- Debes usar TODOS los personajes recibidos en 'characters'.
- Cada personaje debe tener id único, name y prompt.
- Cada escena (nodos no-finales y finales) debe incluir obligatoriamente:
  • sceneCharacters: array de IDs de personajes presentes
  • sceneEnvironment: ID del entorno
  • imagePrompt: cadena de texto que COMIENZA con un header estandarizado de consistencia,
    seguido del prompt normal de la escena.
    > Debes usar EXACTAMENTE este formato de cabecera antes del prompt de escena:
${IMAGE_PROMPT_HEADER_TEMPLATE}
 
Reglas para imagePrompt:
- El header SIEMPRE va primero. No lo omitas.
- Incluye SOLO las fichas de los personajes presentes en sceneCharacters.
- Respeta la paleta y las restricciones (do-not-change) en TODAS las escenas.
- Usa el aspect 4:3 y cámara/iluminación del [STYLE PRESET] salvo que se indique otra cosa.
- Tras el header, redacta el [SCENE PROMPT] en 2–4 líneas máximo, concreto y sin narrativa redundante.

 `;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      // Fragmento del responseSchema (Gemini) o equivalente si usas OpenAI JSON mode
responseSchema: {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    synopsis: { type: "string" },
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          prompt: { type: "string" },
          token: { type: "string" }, // opcional pero recomendado para consistencia
        },
        required: ["id", "name", "prompt"]
      }
    },
    environments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "name"]
      }
    },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string" }, // "start" | "normal" | "ending"
          content: { type: "string" },
          sceneCharacters: {
            type: "array",
            items: { type: "string" },
            minItems: 1
          },
          sceneEnvironment: { type: "string" },
          imagePrompt: {
            type: "string",
            minLength: 120,   // fuerza header + prompt; ajusta a tu gusto
            description: "Debe iniciar con el header estandarizado y luego el [SCENE PROMPT]."
          },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                targetSceneId: { type: "string" }
              },
              required: ["text", "targetSceneId"]
            }
          }
        },
        required: ["id", "type", "content", "sceneCharacters", "sceneEnvironment", "imagePrompt"]
      }
    }
  },
  required: ["id", "title", "synopsis", "characters", "environments", "scenes"]
}
,
    },
  });

  return JSON.parse(response.text ?? "{}");
}