// /controllers/story.controller.ts
import type { SceneForImage, SingleStoryRow, StoryCard, StoryRow } from "../models/story.model";
import { generateStory } from "../services/ia.service";
import { generateImagesConcurrent } from "../services/image.service";
import Logger from "../lib/logger";
import { supabase, supabaseForUser } from '../lib/supabase';
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { uploadBase64Image } from "../controllers/storage.controller"; // ajusta el path si es necesario
import { safeName } from "../lib/strings";
import { pickCoverImage } from "../lib/imagesTools";
import { getFullConfig } from "./config.controller";

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

export const checkStory = async ({ body }: any) => {
  const reqId = `start-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const storyId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const reqLog = log.child({ reqId, storyId });
  const { title, characterName, environment, theme, objetive } = body || {};
  const story = await reqLog.time("Generar historia", async () => {

    const storyRaw = await generateStory(title, characterName, environment, theme, objetive);
    const res = await upsertStory("", storyRaw);
    console.log(res);
    return tryParseJSON<any>(storyRaw) || storyRaw;
  });
}

export const startStory = async ({ userId, body }: { userId: any, body: any }) => {
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

    const { data: existing, error: selErr } = await supabase
      .from("config")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (selErr) return { ok: false, error: selErr };

    const { title, characterName, environment, theme, objetive } = body || {};
    reqLog.info("Solicitud /story/start recibida", {
      bodyPreview: { title, characterName, environment, theme, objetiveDefined: typeof objetive !== "undefined" },
      assetsDir: ASSETS_DIR,
      publicBase: ASSETS_PUBLIC_BASE,
    });

    try {
      // 1) Generar historia

      const configUser = await getFullConfig(userId);
      const { allowed_themes, blocked_themes, child_age_range } = configUser.result ?? {};

      const story = await reqLog.time("Generar historia", async () => {
        const storyRaw = await generateStory(title, characterName, environment, theme, objetive, { allowed_themes, blocked_themes, child_age_range });
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

      const saved = await reqLog.time("Guardar imágenes en Supabase Storage", async () => {
        const BUCKET = "stories-images";
        return Promise.all(
          ok.map(async (it, idx) => {
            const fname = `scene-${safeName(it.sceneId)}-${Date.now()}-${idx}.png`;
            // ruta "lógica" dentro del bucket para ordenar por historia
            const storagePath = `stories/${storyId}/${fname}`;

            const up = await uploadBase64Image({
              bucket: BUCKET,
              path: storagePath,
              b64: it.b64,
              contentType: "image/png",
            });

            if (!up.ok) {
              log.error("Error subiendo imagen a Supabase", { sceneId: it.sceneId, error: up.error?.message });
              throw up.error;
            }

            // Mantiene las mismas claves que antes:
            return {
              sceneId: it.sceneId,
              url: up.url,                    // <- Public URL del archivo en Supabase
              path: `supabase://${BUCKET}/${storagePath}`, // <- referencia interna legible (opcional)
            };
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

export async function upsertStory(userId: string, storyPayload: any) {
  // storyPayload debe ser el JSON completo que mostraste


    const storyId = storyPayload?.id || crypto.randomUUID();

  if (!storyId) {
    return { ok: false, error: new Error("story.id requerido en el payload") };
  }

  // 1) Verificar si existe
  const { data: existing, error: selErr } = await supabase
    .from("stories")
    .select("id")
    .eq("id", storyId)
    .maybeSingle();

  if (selErr) return { ok: false, error: selErr };

  // Datos a guardar
  const record = {
    id: storyId,
    owner_id: userId,
    title: storyPayload.title,
    synopsis: storyPayload.synopsis,
    characters: storyPayload.characters ?? [],
    environments: storyPayload.environments ?? [],
    scenes: storyPayload.scenes ?? [],
    images_by_scene: storyPayload.imagesByScene ?? {},
    delivery: storyPayload.delivery ?? {},
    meta: storyPayload.meta ?? {},
    raw_payload: storyPayload,
    success: storyPayload.success ?? true,
  };

  if (existing) {
    // 2a) Update
    const { data, error } = await supabase
      .from("stories")
      .update(record)
      .eq("id", storyId)
      .select("*")
      .single();

    if (error) return { ok: false, error };
    return { ok: true, data, error: null };
  } else {
    // 2b) Insert
    const { data, error } = await supabase
      .from("stories")
      .insert(record)
      .select("*")
      .single();

    if (error) return { ok: false, error };
    return { ok: true, data, error: null };
  }
}

export async function getStoryCards(
  opts?: { from?: number; to?: number }
): Promise<{ data: StoryCard[] | null; error: any }> {
  const from = opts?.from ?? 0;
  const to = opts?.to ?? from + 19; // 20 items por defecto

  const { data, error } = await supabase
    .from("stories")
    .select("id, title, synopsis, scenes, images_by_scene")
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error) return { data: null, error };

  const cards: StoryCard[] = (data as StoryRow[]).map((row) => ({
    id: row.id,
    title: row.title ?? "(Sin título)",
    synopsis: row.synopsis ?? "",
    cover_image: pickCoverImage(row),
  }));

  return { data: cards, error: null };
}

export async function getStoryRawPayload(
  userId: string,
  storyId: string
): Promise<{ data: any | null; error: any }> {
  const { data, error } = await supabase
    .from("stories")
    .select("id, owner_id, raw_payload")
    .eq("id", storyId)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) return { data: null, error: { message: "Not found" } };

  return { data: (data as SingleStoryRow).raw_payload ?? null, error: null };
}