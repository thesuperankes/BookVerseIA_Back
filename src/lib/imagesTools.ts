import type { StoryRow } from "../models/story.model";

export function pickCoverImage(row: StoryRow): string | null {
  // 2) scenes: array de escenas que podrían traer image/cover/asset
  const scenes = row.scenes;
  if (Array.isArray(scenes) && scenes.length) {
    const s0 = scenes[0];
    if (s0) {
      // diferentes posibles llaves comunes
      if (typeof s0.imageUrl === "string") return s0.imageUrl;
      if (typeof s0.cover === "string") return s0.cover;
      if (typeof s0.asset === "string") return s0.asset;
      // a veces viene como array de assets
      if (Array.isArray(s0.imageUrl) && s0.images.length && typeof s0.images[0] === "string") {
        return s0.images[0];
      }
    }
  }

  return null;
}