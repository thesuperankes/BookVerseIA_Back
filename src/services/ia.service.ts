import { OpenAI } from "openai";
import { env } from "../config/env";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export interface Option {
  text: string;
  nextSceneId: string;
}

export interface Scene {
  id: string;
  content: string;
  imagePrompt: string;
  image?: string;
  options: Option[];
}

export interface InteractiveStory {
  title: string;
  scenes: Scene[];
}

function buildPrompt(ageGroup: string, theme: string, complexity: string): string {
  return `
Quiero que generes un cuento interactivo para niños del grupo de edad ${ageGroup}.
El tema principal debe ser "${theme}". 
Usa un lenguaje con nivel de complejidad "${complexity}". 
Debe tener un inicio atractivo, un desarrollo con conflictos sencillos y un desenlace educativo o abierto.
Agrega tres lugares clave donde el lector pueda tomar decisiones para cambiar el rumbo de la historia.
El cuento debe incluir valores y fomentar la comprensión lectora.
No agregues instrucciones ni explicaciones, solo genera el texto del cuento.
`;
}

export async function createStoryWithAI(
  ageGroup: string,
  theme: string,
  complexity: string = "medio"
): Promise<string> {
  const prompt = buildPrompt(ageGroup, theme, complexity);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Eres un escritor de cuentos infantiles con enfoque educativo, tu idioma de escritura es español" },
      { role: "user", content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 1200,
  });
  return completion.choices[0]?.message?.content || "No se generó historia.";
}

export async function suggestStories(age: number, preferences: string[]): Promise<string[]> {
  const prompt = `Sugiere 5 títulos de libros para una persona de ${age} años con las siguientes preferencias: ${preferences.join(", ")}. Proporciona solo los títulos, uno por línea.`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Eres un experto recomendando libros." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });
  const titles = completion.choices[0]?.message?.content?.split('\n') || [];
  return titles.filter((title) => title.trim() !== '');
}

export async function generateAct1(title: string, mainChar: string, age: number): Promise<string> {
  const prompt = `Escribe el primer acto de una historia para niños de ${age} años. El título es "${title}" y el personaje principal se llama ${mainChar}. Crea un inicio atractivo que presente al personaje principal y el entorno, planteando un pequeño conflicto o misterio que dé pie al resto de la historia.`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Eres un escritor de historias infantiles." },
      { role: "user", content: prompt },
    ],
    temperature: 0.9,
    max_tokens: 800,
  });
  return completion.choices[0]?.message?.content || "No se pudo generar el primer acto.";
}

export async function generateImage(prompt: string, isSticker: boolean = false): Promise<string> {
  const imagePrompt = isSticker ? `Genera un sticker: ${prompt}` : prompt;
  const response: any = await openai.images.generate({
    model: "dall-e-3",
    prompt: imagePrompt,
    response_format: "b64_json",
    n: 1,
    size: "1024x1024",
  });
  return response.data[0].b64_json || "";
}

export async function generateInteractiveStory(
  title: string,
  characterName: string,
  environment: string,
  theme: string,
  objective: string
): Promise<InteractiveStory> {
  const interactivePrompt = `
Eres un autor de cuentos interactivos. Devuelve únicamente un JSON válido sin comentarios ni explicaciones.
La estructura debe ser:
{
  "title": "${title}",
  "scenes": [
    {
      "id": "1",
      "content": "Texto de la escena",
      "imagePrompt": "Descripción de la imagen",
      "options": [ { "text": "Opción del lector", "nextSceneId": "2" }, ... ]
    },
    ...
  ]
}
El cuento está orientado a niños. El personaje principal se llama ${characterName} y debe mantener la misma apariencia y características (color de cabello, vestimenta, rasgos) en todas las escenas. El entorno general de la historia es ${environment} y el tema central es ${theme}. El objetivo del cuento es ${objective} y debe transmitir valores positivos. Incluye al menos tres escenas con opciones para que el lector elija. Para cada escena, genera un campo "imagePrompt" que describa claramente lo que debe ilustrarse, mencionando siempre al personaje principal con sus características constantes y el escenario. No agregues propiedades extra ni texto fuera del JSON.`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Eres un escritor de cuentos interactivos." },
      { role: "user", content: interactivePrompt },
    ],
    temperature: 0.8,
    max_tokens: 1500,
  });
  const content = completion.choices[0]?.message?.content || "{}";
  let story: InteractiveStory;
  try {
    story = JSON.parse(content) as InteractiveStory;
  } catch (err) {
    story = { title, scenes: [] };
  }
  for (const scene of story.scenes) {
    try {
      scene.image = await generateImage(scene.imagePrompt, false);
    } catch (err) {
      scene.image = "";
    }
  }
  return story;
}
