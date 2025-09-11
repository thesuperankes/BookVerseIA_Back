// /controllers/story.controller.ts
import type { SceneForImage } from "../models/story.model";
import { generateStory } from "../services/ia.service";
import { generateImagesConcurrent } from "../services/image.service";
import Logger from "../lib/logger";

import { promises as fs } from "node:fs";
import * as path from "node:path";
const log = Logger.get({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  toFile: true,
  filePath: "./logs/app.log",
  prettyConsole: true,
  colorConsole: true,
  baseContext: { service: "story-controller" },
});

// Config de almacenamiento local
const ASSETS_DIR = process.env.ASSETS_DIR || path.join(process.cwd(), "assets");
const ASSETS_PUBLIC_BASE = (process.env.ASSETS_PUBLIC_BASE || "/assets").replace(/\/+$/, "");

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}
function safeName(s: string) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function buildLocalUrl(storyId: string, fileName: string) {
  return `${ASSETS_PUBLIC_BASE}/${encodeURIComponent(storyId)}/${encodeURIComponent(fileName)}`;
}
async function saveBase64ToFile(dir: string, fileName: string, b64: string): Promise<string> {
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, Buffer.from(b64, "base64"));
  return filePath;
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

// GENERA HISTORIA + IMÁGENES y guarda localmente en assets/
export const startStory = async ({ body }: any) => {
    const reqId = `start-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const storyId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  if (process.env.ISDEV == "true") {
     const mockPath = path.join(process.cwd(), "mock", "story.json");
    const raw = await fs.readFile(mockPath, "utf-8");
    const story = JSON.parse(raw).story;

    // 🔹 En este caso no hay generación de imágenes, pero mantenemos formato
    const scenesWithImages = story.scenes.map((s: any) => ({
      ...s,
      imageUrl: s.imageUrl || null,
      imageB64: null,
      imageMime: s.imageUrl ? "image/png" : null,
      imageError: null,
    }));

    const imagesByScene: Record<string, { url?: string; mime?: string; error?: string }> = {};
    for (const s of scenesWithImages) {
      imagesByScene[s.id] = {
        url: s.imageUrl || undefined,
        mime: s.imageMime || undefined,
        error: undefined,
      };
    }

    const storyDir = path.join(process.cwd(), "assets", storyId); // simulado
    const ASSETS_PUBLIC_BASE = process.env.ASSETS_PUBLIC_BASE || "/assets";

    return {
      success: true,
      story: { ...story, id: storyId, scenes: scenesWithImages },
      imagesByScene,
      delivery: { mode: "urls", localDir: storyDir, publicBase: ASSETS_PUBLIC_BASE },
      meta: { reqId },
    };
  } else {
    const reqId = `start-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const storyId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const reqLog = log.child({ reqId, storyId });

    const { title, characterName, environment, theme, objetive } = body || {};
    reqLog.info("Solicitud /story/start recibida", {
      bodyPreview: { title, characterName, environment, theme, objetiveDefined: typeof objetive !== "undefined" },
      assetsDir: ASSETS_DIR,
      publicBase: ASSETS_PUBLIC_BASE,
    });

    try {
      // 1) Generar historia
      const story = await reqLog.time("Generar historia", async () => {
        const storyRaw = await generateStory(title, characterName, environment, theme, objetive);
        return tryParseJSON<any>(storyRaw) || storyRaw;
      });

      const scenesCount = story?.scenes?.length ?? 0;
      reqLog.info("Historia generada", { scenesCount, firstSceneId: scenesCount ? story.scenes[0]?.id : null });

      if (!story?.scenes || !Array.isArray(story.scenes) || scenesCount === 0) {
        reqLog.error("No se generaron escenas");
        return { success: false, message: "No se pudieron generar escenas" };
      }

      // 2) Preparar prompts para imágenes
      const scenesForImage: SceneForImage[] = story.scenes
        .filter((s: any) => !!s?.imagePrompt && !!s?.id)
        .map((s: any) => ({ id: s.id, imagePrompt: s.imagePrompt }));

      if (!scenesForImage.length) {
        reqLog.warn("No hay escenas con imagePrompt");
        return { success: false, message: "Las escenas no contienen imagePrompt" };
      }
      reqLog.info("Escenas preparadas para imágenes", { toRender: scenesForImage.length });

      // 3) Generar imágenes en concurrencia
      const images = await reqLog.time("Generar imágenes", async () => {
        return generateImagesConcurrent(scenesForImage, {
          model: "gpt-5",
          maxConcurrency: 8 as any, // ignorado por Responses API interna pero lo mantenemos por compat
        } as any);
      });

      const ok = images.filter((i) => !i.error);
      const fail = images.filter((i) => i.error);
      reqLog.info("Imágenes generadas", {
        total: images.length, ok: ok.length, fail: fail.length,
        failedIds: fail.map(f => ({ sceneId: f.sceneId, error: f.error })),
      });

      // 4) Guardar localmente en assets/<storyId>/scene-*.png y devolver URLs
      const storyDir = path.join(ASSETS_DIR, safeName(storyId));
      await ensureDir(storyDir);

      const saved = await reqLog.time("Guardar imágenes localmente", async () => {
        return Promise.all(
          ok.map(async (it, idx) => {
            const fname = `scene-${safeName(it.sceneId)}-${Date.now()}-${idx}.png`;
            const filePath = await saveBase64ToFile(storyDir, fname, it.b64);
            const url = buildLocalUrl(storyId, fname);
            return { sceneId: it.sceneId, url, path: filePath };
          })
        );
      });

      const urlByScene = new Map<string, string>(saved.map(s => [s.sceneId, s.url]));

      // 5) Enriquecer escenas con URL (sin base64 en el response)
      const scenesWithImages = story.scenes.map((s: any) => ({
        ...s,
        imageUrl: urlByScene.get(s.id) || null,
        imageB64: null,
        imageMime: urlByScene.has(s.id) ? "image/png" : null,
        imageError: fail.find(f => f.sceneId === s.id)?.error || null,
      }));

      const imagesByScene: Record<string, { url?: string; mime?: string; error?: string }> = {};
      for (const s of scenesWithImages) {
        imagesByScene[s.id] = {
          url: s.imageUrl || undefined,
          mime: s.imageMime || undefined,
          error: s.imageError || undefined,
        };
      }

      reqLog.info("startStory completado", {
        scenes: scenesWithImages.length,
        withUrl: scenesWithImages.filter((s: any) => s.imageUrl).length,
        withError: scenesWithImages.filter((s: any) => s.imageError).length,
        assetsDir: ASSETS_DIR,
        publicBase: ASSETS_PUBLIC_BASE,
      });

      return {
        success: true,
        story: { ...story, id: storyId, scenes: scenesWithImages },
        imagesByScene,
        delivery: { mode: "urls", localDir: storyDir, publicBase: ASSETS_PUBLIC_BASE },
        meta: { reqId },
      };
    } catch (err: any) {
      reqLog.error("Fallo en startStory", {
        name: err?.name, code: err?.code, status: err?.status, message: err?.message,
      });
      return {
        success: false,
        message: "Error generando historia o imágenes",
        error: { name: err?.name, code: err?.code, status: err?.status, message: err?.message },
        meta: { reqId },
      };
    }
  }
};