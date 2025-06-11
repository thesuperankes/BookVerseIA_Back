import { suggestStories, generateAct1, generateImage } from "../services/ia.service";

export const getSuggestedStories = async ({ body }: any) => {
  const { age, preferences } = body;

  if (!age || !preferences) {
    return {
      success: false,
      message: "Missing age or preferences",
    };
  }

  const suggested = await suggestStories(age, preferences);

  return {
    success: true,
    stories: suggested,
  };
};

export const createStoryAct1 = async ({ body }: any) => {
  const { title, mainChar, age } = body;

  if (!title || !mainChar || !age) {
    return {
      success: false,
      message: "Missing title, main character, or age",
    };
  }

  const act1 = await generateAct1(title, mainChar, age);

  return {
    success: true,
    act1,
  };
};

export const createImage = async ({ body }: any) => {
  const { prompt, isSticker } = body;

  const image = await generateImage(prompt, isSticker);

  return {
    success: true,
    image,
  };
};
import { createStoryWithAI } from "../services/ia.service";

// /controllers/story.controller.ts
export const generateStory = async ({ body }: any) => {

  console.log("Se inicia la generación de historias");

  const { ageGroup, theme, languageLevel} = body;

  console.log(`se genera con los parametros ${ ageGroup } tema: ${ theme } Complejidad ${ languageLevel }`);

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