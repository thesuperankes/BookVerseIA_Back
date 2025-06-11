// /services/ia.service.ts
import { OpenAI } from "openai"; // o tu cliente IA preferido (DeepSeek puede tener uno propio)
import { env } from "../config/env";

// Instancia del cliente OpenAI (ajusta según el proveedor real)
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY, // clave guardada en .env
});

/**
 * Genera una historia con IA basada en el grupo de edad y el tema.
 * @param ageGroup Edad del lector (por ejemplo: "6-8", "9-14", "15-17")
 * @param theme Tema del cuento (ej: "aventura", "ciencia", "magia")
 * @param complexity Nivel de dificultad textual ("ligero", "medio", "alto")
 */
export async function createStoryWithAI(
  ageGroup: string,
  theme: string,
  complexity: string = "medio"
): Promise<string> {
  const prompt = buildPrompt(ageGroup, theme, complexity);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // o el modelo que uses (ej. "deepseek-r1-chat")
    messages: [
      {
        role: "system",
        content: "Eres un escritor de cuentos infantiles con enfoque educativo, tu idioma de escritura es español",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.8,
    max_tokens: 1200,
  });

  return completion.choices[0]?.message?.content || "No se generó historia.";
}

/**
 * Sugiere títulos de libros basados en la edad y preferencias del usuario.
 * @param age Edad del usuario.
 * @param preferences Preferencias del usuario (temas, géneros, etc.).
 */
export async function suggestStories(age: number, preferences: string[]): Promise<string[]> {
  const prompt = `Sugiere 5 títulos de libros para una persona de ${age} años con las siguientes preferencias: ${preferences.join(", ")}. Proporciona solo los títulos, uno por línea.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // o el modelo que uses
    messages: [
      {
        role: "system",
        content: "Eres un experto recomendando libros.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
  });

  const titles = completion.choices[0]?.message?.content?.split('\n') || [];
  return titles.filter(title => title.trim() !== '');
}

/**
 * Genera el primer acto de una historia.
 * @param title Título de la historia.
 * @param mainChar Nombre del personaje principal.
 * @param age Edad del público objetivo.
 */
export async function generateAct1(title: string, mainChar: string, age: number): Promise<string> {
  const prompt = `Escribe el primer acto de una historia para niños de ${age} años. El título es "${title}" y el personaje principal se llama ${mainChar}. Crea un inicio atractivo que presente al personaje principal y el entorno, planteando un pequeño conflicto o misterio que dé pie al resto de la historia.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // o el modelo que uses
    messages: [
      {
        role: "system",
        content: "Eres un escritor de historias infantiles.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.9,
    max_tokens: 800,
  });

  return completion.choices[0]?.message?.content || "No se pudo generar el primer acto.";
}

/**
 * Construye el prompt dinámicamente según los parámetros.
 */
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

/**
 * Genera una imagen base64 a partir de un prompt.
 * @param prompt Descripción de la imagen deseada.
 * @param isSticker Indica si la imagen debe ser un sticker.
 */
export async function generateImage(prompt: string, isSticker: boolean = false): Promise<string> {
  const imagePrompt = isSticker ? `Genera un sticker: ${prompt}` : prompt;

  // Nota: La API de imágenes de OpenAI o DeepSeek podría requerir un enfoque diferente
  // para generar stickers o controlar estilos. Este es un ejemplo general.
  const response:any = await openai.images.generate({
    model: "dall-e-3", // o el modelo de generación de imágenes que uses
    prompt: imagePrompt,
    response_format: "b64_json", // Solicita formato base64
    n: 1, // Generar 1 imagen
    size: "1024x1024", // Tamaño de la imagen
  });

  // La respuesta contiene un array, tomamos el primer resultado
  return response.data[0].b64_json || "";
}
