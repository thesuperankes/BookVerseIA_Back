export type SceneForImage = {
  id: string;
  imagePrompt: string;   // Debe venir con el header estándar
};

export type ImageGenOptions = {
  model?: "gpt-5" | "gpt-4o";
  size?: "1024x768" | "1024x1024" | "768x1024";
  maxConcurrency?: number;   // workers paralelos
  nPerScene?: number;        // por si quieres más de 1 variación
};

export type SceneImageResult = {
  sceneId: string;
  b64: string;               // base64 sin prefijo data:
  mime: "image/png";
  error?: string;
};