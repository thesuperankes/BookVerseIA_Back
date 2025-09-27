// /services/ia.service.ts
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env";
import type { ImageGenOptions, SceneForImage, SceneImageResult } from "../models/story.model";
import { getAge } from "../lib/userHelper";


const modelToUse = env.MODEL_GEMINI || "gemini-2.5-flash";
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function generateStory(
  title: string,
  characterName: string,
  environment: string,
  theme: string,
  objetive: string,
  parentalConfig?: { allowed_themes?: string[]; blocked_themes?: string[]; child_age_range?: string; }

): Promise<any> {

 // Si no hay configuración, no afecta el prompt
const temasPermitidos =
  parentalConfig?.allowed_themes && parentalConfig.allowed_themes.length > 0
    ? `Los temas permitidos son: ${parentalConfig.allowed_themes.join(", ")}.`
    : "";

const temasBloqueados =
  parentalConfig?.blocked_themes && parentalConfig.blocked_themes.length > 0
    ? `No incluir los siguientes temas: ${parentalConfig.blocked_themes.join(", ")}.`
    : "";

const ageText =
  parentalConfig?.child_age_range
    ? `La historia debe ser apropiada para niños de ${ getAge(parentalConfig.child_age_range)}.`
    : "";


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
- ${temasPermitidos}
- ${temasBloqueados}
- ${ageText}

Estructura:
- El id del story debe ser un token generado de forma aleatoria, no el conjunto del nombre, debe tener una longitud de 32 caracteres exactos
- Usa scene.type ∈ {"decision","linear","ending"}.
- decision: 2–3 opciones, cada una con nextId.
- linear: 0 opciones, debe tener nextId.
- ending: 0 opciones, sin nextId.
- ≥30% de escenas deben ser decision.
- ≥3 escenas de tipo ending.
- Todos los nextId deben existir en scenes[].id (no ids huérfanos).
- No generes escenas con solo 1 opción.
- Mantén consistencia temática y evita loops.

Requisitos generales:
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

Censura es primordial que mantengas las siguientes reglas:
- Si el usuario solicita algun tipo de cuento +18 debes responder con demasiada censura y tomando el tema base y ofreciendo un cuento seguro para niños entre 6 y 14 años.
- Nunca debes responder con un cuento que entre en la categoria +18 y que no toque ningun tipo de tema parecido, en su lugar debe crear un cuento seguro.
- Siempre debes responder con un cuento con una moraleja para el grupo de edad seleccionado.
- Nunca entrar en temas politicos, xenofobos o racistas; crea un cuento apropiado para niños.
- En cuentos que contengan palabras para adultos o que puedan implicar un minimo tono sexual, debes sustituir esas palabras por otras que sean aptas para niños.
- Si el usuario insiste en solicitar un cuento +18 debes negarte a hacerlo y ofrecer un cuento seguro para niños entre 6 y 14 años.
- Si el usuario insiste en solicitar un cuento con temas politicos, xenofobos o racistas debes negarte a hacerlo y ofrecer un cuento seguro para niños entre 6 y 14 años.
- Si el usuario insiste en solicitar un cuento con temas de violencia debes negarte a hacerlo y ofrecer un cuento seguro para niños entre 6 y 14 años.
- Si el usuario insiste en solicitar un cuento con temas de drogas o alcohol debes negarte a hacerlo y ofrecer un cuento seguro para niños entre 6 y 14 años.
- Si el usuario genera un titulo o personaje con temas +18, politicos, xenofobos o racistas debes negarte a hacerlo y ofrecer un titulo seguro para niños entre 6 y 14 años.
- si el usuario pide algun cuento con derechos de autor o marcas registradas debes negarte a hacerlo y ofrecer un cuento con personajes y titulos originales.



Reglas para imagePrompt:
- El header SIEMPRE va primero. No lo omitas.
- Incluye SOLO las fichas de los personajes presentes en sceneCharacters.
- Respeta la paleta y las restricciones (do-not-change) en TODAS las escenas.
- Usa aspect 4:3 y cámara/iluminación del [STYLE PRESET] salvo que se indique otra cosa.
- Tras el header, redacta el [SCENE PROMPT] en 2–4 líneas máximo, concreto y sin narrativa redundante.

Minijuegos por escena (usa ÚNICAMENTE la información de la escena):
- Cada escena debe incluir un array 'miniGames' con 1 a 3 minijuegos, elegidos entre:
  • MultipleChoice: { question, options[3..5], correctIndex }
  • TrueFalse: { statement, isTrue }
  • FillInTheBlank: { sentence con "____", answers[string[]] (sin tildes opcionales) }
  • ImageHotspot: { target: { x, y, r, label } }  // x,y,r en [0..1] relativos a la MISMA imagen de la escena
  • ZoomGuess: { question, answer }               // 'answer' debe ser una palabra o frase corta visible/importante en la escena
- Los minijuegos deben ser resolubles leyendo la escena o mirando su imagen; NUNCA dependas de assets externos ni de personajes no presentes.
- No repitas el mismo tipo más de 1 vez por escena.
- Mantén el lenguaje claro y apropiado para niños; ajusta la complejidad del enunciado a 5–14 años.
- Opcional: incluye 'points' (entero 1–10) y 'ageMin'/'ageMax' para orientar dificultad.

Devuelve TODO en JSON EXACTAMENTE con el schema indicado.`;


console.log(prompt)

  const response = await ai.models.generateContent({
    model: modelToUse,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      // Fragmento del responseSchema (Gemini) o equivalente si usas OpenAI JSON mode
      responseSchema: {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "synopsis": { "type": "string" },
          "characters": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "name": { "type": "string" },
                "prompt": { "type": "string" },
                "token": { "type": "string" }
              },
              "required": ["id", "name", "prompt"]
            }
          },
          "environments": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "name": { "type": "string" },
                "description": { "type": "string" }
              },
              "required": ["id", "name"]
            }
          },
          "scenes": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "type": { "type": "string" },
                "content": { "type": "string" },
                "sceneCharacters": {
                  "type": "array",
                  "items": { "type": "string" },
                  "minItems": 1
                },
                "sceneEnvironment": { "type": "string" },
                "imagePrompt": {
                  "type": "string",
                  "minLength": 120,
                  "description": "Debe iniciar con el header estandarizado y luego el [SCENE PROMPT]."
                },
                "options": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "text": { "type": "string" },
                      "targetSceneId": { "type": "string" }
                    },
                    "required": ["text", "targetSceneId"]
                  }
                },
                "miniGames": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "id": { "type": "string" },
                      "type": {
                        "type": "string",
                        "enum": ["MultipleChoice", "TrueFalse", "FillInTheBlank", "ImageHotspot", "ZoomGuess"]
                      },

                      "points": { "type": "integer", "minimum": 1, "maximum": 10 },
                      "ageMin": { "type": "integer", "minimum": 5, "maximum": 14 },
                      "ageMax": { "type": "integer", "minimum": 5, "maximum": 14 },

                      /* Campos específicos por tipo (opcionales) */
                      "question": { "type": "string" },                      /* MultipleChoice, ZoomGuess */
                      "options": {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 3,
                        "maxItems": 5
                      },
                      "correctIndex": { "type": "integer", "minimum": 0 },   /* MultipleChoice */

                      "statement": { "type": "string" },                     /* TrueFalse */
                      "isTrue": { "type": "boolean" },                       /* TrueFalse */

                      "sentence": { "type": "string" },                      /* FillInTheBlank */
                      "answers": {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 1
                      },                                                     /* FillInTheBlank */

                      "target": {                                            /* ImageHotspot */
                        "type": "object",
                        "additionalProperties": false,
                        "properties": {
                          "x": { "type": "number", "minimum": 0, "maximum": 1 },
                          "y": { "type": "number", "minimum": 0, "maximum": 1 },
                          "r": { "type": "number", "minimum": 0.02, "maximum": 0.5 },
                          "label": { "type": "string" }
                        },
                        "required": ["x", "y", "r", "label"]
                      },

                      "answer": { "type": "string" }                         /* ZoomGuess */
                    },
                    "required": ["id", "type", "points", "ageMin", "ageMax"]
                  }
                }

              },
              "required": ["id", "type", "content", "sceneCharacters", "sceneEnvironment", "imagePrompt"]
            }
          }
        },
        "required": ["id", "title", "synopsis", "characters", "environments", "scenes"]
      }

      ,
    },
  });

  return JSON.parse(response.text ?? "{}");
}