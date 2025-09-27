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

export type StoryRow = {
  id: string;
  title: string | null;
  synopsis: string | null;
  scenes?: any;            // jsonb
  images_by_scene?: any;   // jsonb
};

export type StoryCard = {
  id: string;
  title: string;
  synopsis: string;
  cover_image: string | null;
};

export type SingleStoryRow = {
  id: string;
  owner_id: string;
  raw_payload: any;
};