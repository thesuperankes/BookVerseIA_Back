import { createStoryWithAI } from "../services/ia.service";

// /controllers/story.controller.ts
export const generateStory = async ({ body }: any) => {
  const { ageGroup, theme, languageLevel } = body;

  // Aquí usarías tu servicio IA (DeepSeek / GPT)
  const story = await createStoryWithAI(ageGroup, theme, languageLevel);

  return {
    success: true,
    story,
  };
};


export const testStory = async ({  }: any) => {
  return {
    success: true,
    story: 'Esta es la respuesta para la prueba de la generación de una historia',
  };
};