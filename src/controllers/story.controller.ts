import {
  generateAct2,
  generateFinalAct,
  generateRecommendations,
  generateStoryElements,
  generateCharacterStickerDescription,
  generateGamification,
  generateIntroduction
} from "../services/ia.service";


// 🆕 Recomendaciones
export const createRecommendations = async ({ body }: any) => {
  const { sinopsis } = body;

  if (!sinopsis) {
    return {
      success: false,
      message: "Missing synopsis",
    };
  }

  const recommendations = await generateRecommendations(sinopsis);

  return {
    success: true,
    recommendations,
  };
};

// 🆕 Título, personaje, escenario, conflicto
export const createStoryElements = async ({ body }: any) => {
  const { sinopsis, recommendations } = body;

  if (!sinopsis || !recommendations) {
    return {
      success: false,
      message: "Missing synopsis or recommendations",
    };
  }

  const elements = await generateStoryElements(sinopsis, recommendations);

  return {
    success: true,
    elements,
  };
};

// 🆕 Descripción visual del personaje para sticker
export const createStickerDescription = async ({ body }: any) => {
  const { nombre, descripcion } = body;

  if (!nombre || !descripcion) {
    return {
      success: false,
      message: "Missing character name or description",
    };
  }

  const description = await generateCharacterStickerDescription(nombre, descripcion);

  return {
    success: true,
    description,
  };
};

// 🆕 Segundo acto
export const createStoryAct2 = async ({ body }: any) => {
  const { act1 } = body;

  if (!act1) {
    return {
      success: false,
      message: "Missing Act 1 content",
    };
  }

  const act2 = await generateAct2(act1);

  return {
    success: true,
    act2,
  };
};

// 🆕 Acto final
export const createFinalAct = async ({ body }: any) => {
  const { act2 } = body;

  if (!act2) {
    return {
      success: false,
      message: "Missing Act 2 content",
    };
  }

  const finalAct = await generateFinalAct(act2);

  return {
    success: true,
    finalAct,
  };
};

// 🆕 Gamificación
export const createGamification = async ({ body }: any) => {
  const { acts } = body;

  if (!acts || !Array.isArray(acts)) {
    return {
      success: false,
      message: "Missing or invalid story acts",
    };
  }

  const gamification = await generateGamification(acts);

  return {
    success: true,
    gamification,
  };
};

// Test de conexión
export const testStory = async () => {
  return {
    success: true,
    story: 'Esta es la respuesta para la prueba de la generación de una historia',
  };
};

export const startStory = async ({ body }: any) => {
  const { title, characterName,environment, theme,objetive } = body;

  const story = await generateIntroduction(title, characterName,environment, theme,objetive);

  return {
    success: true,
    story,
  };
};