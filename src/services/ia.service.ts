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
        content: "Eres un escritor de cuentos infantiles con enfoque educativo.",
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
