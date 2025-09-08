// /controllers/story.controller.ts
import type { SceneForImage } from "../models/story.model";
import { generateStory } from "../services/ia.service";
import { generateImagesConcurrent } from "../services/image.service";

/* ============================================================
 * Utilidades de logging / diagnóstico
 * ============================================================ */

type LogLevel = "info" | "warn" | "error" | "debug";
const DEBUG_STORY =
  String(process.env.DEBUG_STORY ?? "false").toLowerCase() === "true";

function now() { return Date.now(); }
function ms(dt: number) { return `${dt}ms`; }
function snippet(text: string, len = 160) {
  if (!text) return "";
  const t = String(text).replace(/\s+/g, " ").trim();
  return t.length > len ? `${t.slice(0, len)}…` : t;
}
function log(level: LogLevel, msg: string, meta: Record<string, any> = {}) {
  if (!DEBUG_STORY && level === "debug") return;
  const line = {
    ts: new Date().toISOString(),
    level,
    src: "story.controller",
    msg,
    ...meta,
  };
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](JSON.stringify(line));
}
function tryParseJSON<T = any>(raw: any): T | null {
  if (typeof raw !== "string") return raw as T;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

/* ============================================================
 * Test de conexión
 * ============================================================ */

export const testStory = async () => {
  return { success: true, story: "Juancho cuando vamos a farrear?" };
};

/* ============================================================
 * startStory con trazas detalladas
 * ============================================================ */

export const startStory = async ({ body }: any) => {
  const reqId = `start-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const t0 = now();

  // Nota: tu payload usa "objetive" (no "objective"). Lo registramos para detectar mismatches.
  const { title, characterName, environment, theme, objetive } = body || {};

  log("info", "Solicitud recibida", {
    reqId,
    bodyPreview: { title, characterName, environment, theme, objetiveDefined: typeof objetive !== "undefined" },
  });

  try {
    /* 1) Generar historia (con scenes + imagePrompt) */
    const tStory0 = now();
    log("info", "Generando historia", { reqId });

    const storyRaw = await generateStory(title, characterName, environment, theme, objetive);
    const storyParsed = tryParseJSON<any>(storyRaw);
    const story = storyParsed || storyRaw;

    const scenesCount = story?.scenes?.length ?? 0;
    log("info", "Historia generada", {
      reqId,
      took: ms(now() - tStory0),
      hasScenes: Boolean(story?.scenes),
      scenesCount,
      firstSceneId: scenesCount ? story.scenes[0]?.id : null,
    });

    if (!story?.scenes || !Array.isArray(story.scenes) || scenesCount === 0) {
      log("error", "No se generaron escenas", { reqId, storyType: typeof storyRaw });
      return { success: false, message: "No se pudieron generar escenas" };
    }

    const missingPromptIds = story.scenes
      .filter((s: any) => !s?.imagePrompt)
      .map((s: any) => s?.id)
      .filter(Boolean);

    if (missingPromptIds.length) {
      log("warn", "Escenas sin imagePrompt", { reqId, missingPromptIds, count: missingPromptIds.length });
    }

    /* 2) Preparar escenas para imagen */
    const scenesForImage: SceneForImage[] = story.scenes
      .filter((s: any) => !!s?.imagePrompt && !!s?.id)
      .map((s: any) => ({ id: s.id, imagePrompt: s.imagePrompt }));

    log("info", "Escenas preparadas para imágenes", {
      reqId,
      toRender: scenesForImage.length,
      firstPromptPreview: scenesForImage[0] ? snippet(scenesForImage[0].imagePrompt, 200) : null,
    });

    if (!scenesForImage.length) {
      return { success: false, message: "Las escenas no contienen imagePrompt" };
    }

    /* 3) Generar imágenes en concurrencia */
    const tImg0 = now();
    log("info", "Generando imágenes (concurrencia)", {
      reqId,
      count: scenesForImage.length,
      model: "gpt-5",
      maxConcurrency: 8,
    });

    const images = await generateImagesConcurrent(scenesForImage, {
      model: "gpt-5",
      // Los siguientes parámetros se ignoran si usas Responses API interna,
      // pero los dejamos por compatibilidad con tu modelo de tipos:
      size: "1024x768" as any,
      maxConcurrency: 8 as any,
      nPerScene: 1 as any,
    } as any);

    const ok = images.filter((i) => !i.error).length;
    const fail = images.filter((i) => i.error).length;
    const failedIds = images.filter((i) => i.error).map((i) => ({ sceneId: i.sceneId, error: i.error }));

    log("info", "Imágenes generadas", {
      reqId,
      took: ms(now() - tImg0),
      total: images.length,
      ok,
      fail,
      failedIds,
    });

    /* 4) Mapear resultados y anexar a la historia */
    const imagesByScene: Record<string, { b64: string; mime: string; error?: string }> = {};
    for (const img of images) {
      imagesByScene[img.sceneId] = {
        b64: img.b64,
        mime: img.mime,
        ...(img.error ? { error: img.error } : {}),
      };
    }

    const scenesWithImages = story.scenes.map((s: any) => ({
      ...s,
      imageB64: imagesByScene[s.id]?.b64 || null,
      imageMime: imagesByScene[s.id]?.mime || null,
      imageError: imagesByScene[s.id]?.error || null,
    }));

    const tTotal = ms(now() - t0);
    log("info", "startStory completado", {
      reqId,
      took: tTotal,
      scenes: scenesWithImages.length,
      withImage: scenesWithImages.filter((s: any) => s.imageB64).length,
      withError: scenesWithImages.filter((s: any) => s.imageError).length,
    });

    return {
      success: true,
      story: { ...story, scenes: scenesWithImages },
      imagesByScene, // útil para el front
      meta: { reqId, took: tTotal },
    };
  } catch (err: any) {
    log("error", "Fallo en startStory", {
      reqId,
      name: err?.name,
      code: err?.code,
      status: err?.status,
      message: err?.message,
      stack: DEBUG_STORY ? err?.stack : undefined,
    });
    return {
      success: false,
      message: "Error generando historia o imágenes",
      error: {
        name: err?.name,
        code: err?.code,
        status: err?.status,
        message: err?.message,
      },
      meta: { reqId, took: ms(now() - t0) },
    };
  }
};
