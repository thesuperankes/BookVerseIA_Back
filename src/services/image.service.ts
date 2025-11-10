// /services/image.service.ts
import OpenAI from "openai";
import { env } from "../config/env";
import type { ImageGenOptions, SceneForImage, SceneImageResult } from "../models/story.model";

/* ============================================================
 * Logging & diagnóstico
 * ============================================================ */

type LogLevel = "info" | "warn" | "error" | "debug";
const DEBUG_IMAGES =
  String((env as any)?.DEBUG_IMAGES ?? process.env.DEBUG_IMAGES ?? "false").toLowerCase() === "true";

function now() {
  return Date.now();
}
function ms(dt: number) {
  return `${dt}ms`;
}
function snippet(text: string, len = 160) {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > len ? `${t.slice(0, len)}…` : t;
}
function log(level: LogLevel, msg: string, meta: Record<string, any> = {}) {
  // En debug mostramos todo; en modo normal: info/warn/error
  if (!DEBUG_IMAGES && level === "debug") return;
  const line = {
    ts: new Date().toISOString(),
    level,
    src: "image.service",
    msg,
    ...meta,
  };
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](JSON.stringify(line));
}

/* ============================================================
 * Cliente OpenAI
 * - Forzamos baseURL oficial para evitar "path undefined"
 * - Verificamos entorno
 * ============================================================ */

const REQUIRED_NODE_MAJOR = 18;
const nodeMajor = Number(process.versions.node.split(".")[0] || "0");
if (Number.isFinite(nodeMajor) && nodeMajor < REQUIRED_NODE_MAJOR) {
  log("warn", "Node version inferior a la recomendada por el SDK de OpenAI", {
    node: process.versions.node,
    requiredMajor: REQUIRED_NODE_MAJOR,
  });
}

if (!env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY no está definido en config/env");
}

// 🔒 Forzamos baseURL oficial para evitar que un OPENAI_BASE_URL inválido rompa el path
const FORCED_BASE_URL = "https://api.openai.com/v1";

// ✅ Instancia única del cliente OpenAI
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY!,
  baseURL: FORCED_BASE_URL,
});

/* ============================================================
 * Concurrencia (sin dependencias externas)
 * ============================================================ */

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let nextIndex = 0;
  let done = 0;

  async function run(workerId: number) {
    log("debug", "Runner iniciado", { workerId });
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) break;
      const start = now();
      try {
        log("debug", "Tarea asignada al runner", { workerId, index: i });
        ret[i] = await worker(items[i], i);
      } finally {
        done++;
        onProgress?.(done, items.length);
        log("debug", "Tarea finalizada por runner", { workerId, index: i, took: ms(now() - start) });
      }
    }
    log("debug", "Runner completado", { workerId });
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, (_, k) => run(k + 1));
  await Promise.all(runners);
  return ret;
}

/* ============================================================
 * Validación del header estándar
 * ============================================================ */

function hasHeaderTemplate(imgPrompt: string): boolean {
  return (
    typeof imgPrompt === "string" &&
    imgPrompt.includes("[CHARACTER SHEET]") &&
    imgPrompt.includes("[STYLE PRESET]") &&
    imgPrompt.includes("[SCENE PROMPT]")
  );
}
/** Responses API + tool image_generation (flujo recomendado) */
async function generateOneWithResponses(prompt: string, model: "gpt-5" | "gpt-4o", ctx: Record<string, any>) {
  const t0 = now();
  log("info", "Intento Responses API", { ...ctx, model, promptPreview: snippet(prompt) });

  const response = await openai.responses.create({
    model,
    input: prompt,
    tools: [{ type: "image_generation" } as any],
  });

  const dt = now() - t0;
  const output = (response as any)?.output ?? [];
  const imageBase64List = output
    .filter((o: any) => o?.type === "image_generation_call")
    .map((o: any) => o?.result)
    .filter(Boolean);

  log("info", "Responses API resuelta", {
    ...ctx,
    model,
    took: ms(dt),
    outputs: Array.isArray(output) ? output.length : 0,
    images: imageBase64List.length,
  });

  const first = imageBase64List[0];
  if (!first) {
    throw new Error("La respuesta no contiene imagen (output vacío).");
  }
  return first as string; // base64
}

/** Images API (fallback robusto) */
async function generateOneWithImagesAPI(
  prompt: string,
  size: "1024x768" | "1024x1024" = "1024x768",
  ctx: Record<string, any> = {}
) {
  const imageModel = ((env as any)?.OPENAI_IMAGE_MODEL as "gpt-image-1" | "dall-e-3") || "gpt-image-1";
  const t0 = now();
  log("info", "Intento Images API (fallback)", { ...ctx, imageModel, size, promptPreview: snippet(prompt) });

  const res = await openai.images.generate({
    model: imageModel,
    prompt,
    size,
    response_format: "b64_json",
  } as any);

  const dt = now() - t0;
  const first = (res as any)?.data?.[0]?.b64_json;
  log("info", "Images API resuelta", {
    ...ctx,
    imageModel,
    size,
    took: ms(dt),
    hasImage: Boolean(first),
    dataLen: first ? String(first).length : 0,
  });

  if (!first) {
    throw new Error("Images API no retornó b64_json");
  }
  return first as string; // base64
}

/* ============================================================
 * API pública: batch concurrente con trazas detalladas
 * ============================================================ */

export async function generateImagesConcurrent(
  scenes: SceneForImage[],
  opts: ImageGenOptions = {}
): Promise<any[]> {
  const {
    model = "gpt-5", // primario para Responses API
    maxConcurrency = 8,
  } = opts;

  const modelCandidates: Array<"gpt-5" | "gpt-4o"> =
    (model as any) === "gpt-5" ? ["gpt-5", "gpt-4o"] : [model as "gpt-4o", "gpt-4o"];

  const batchId = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const tBatch0 = now();

  log("info", "Batch de imágenes iniciado", {
    batchId,
    scenes: scenes.length,
    maxConcurrency,
    modelCandidates,
    baseURL: FORCED_BASE_URL,
    node: process.versions.node,
    debug: DEBUG_IMAGES,
  });

  let lastProgressLog = 0;
  const results = await mapWithConcurrency(
    scenes,
    maxConcurrency,
    async (scene, index) => {
      const sceneLog = { batchId, sceneIndex: index, sceneId: scene?.id };
      const t0 = now();

      try {
        log("info", "Escena encolada", { ...sceneLog });

        if (!scene?.imagePrompt) {
          throw new Error("imagePrompt ausente");
        }
        if (!hasHeaderTemplate(scene.imagePrompt)) {
          log("warn", "Header estándar ausente o incompleto", {
            ...sceneLog,
            promptPreview: snippet(scene.imagePrompt),
          });
          throw new Error("imagePrompt sin header estándar requerido");
        }

        // 1) Responses API: gpt-5 -> gpt-4o
        let lastErr: any = null;
        for (const m of modelCandidates) {
          try {
            const b64 = await generateOneWithResponses(scene.imagePrompt, m, sceneLog);
            log("info", "Imagen generada (Responses API)", {
              ...sceneLog,
              model: m,
              took: ms(now() - t0),
              b64Len: String(b64).length,
            });
            return { sceneId: scene.id, b64, mime: "image/png" as const };
          } catch (e: any) {
            lastErr = e;
            const msg: string = e?.message || "";
            const status = e?.status || e?.code || "";
            const isPathErr = /The "path" argument must be of type string/i.test(msg);
            log("warn", "Fallo Responses API", {
              ...sceneLog,
              modelTried: m,
              status,
              message: msg,
              isPathErr,
            });
            // Si es 404 o "path undefined" u otro error, seguimos con siguiente candidato
            continue;
          }
        }

        // 2) Fallback duro: Images API
        try {
          const b64 = await generateOneWithImagesAPI(scene.imagePrompt, "1024x768", sceneLog);
          log("info", "Imagen generada (Images API fallback)", {
            ...sceneLog,
            took: ms(now() - t0),
            b64Len: String(b64).length,
          });
          return { sceneId: scene.id, b64, mime: "image/png" as const };
        } catch (e2: any) {
          log("error", "Fallo también en Images API", {
            ...sceneLog,
            status: e2?.status || e2?.code,
            message: e2?.message,
          });
          throw lastErr ?? e2;
        }
      } catch (err: any) {
        log("error", "Imagen no generada para escena", {
          ...sceneLog,
          status: err?.status || err?.code,
          message: err?.message,
        });
        return {
          sceneId: scene?.id || `unknown-${index}`,
          b64: "",
          mime: "image/png",
          error: `${err?.status || err?.code || ""} ${err?.message || "Error desconocido"}`.trim(),
        };
      }
    },
    (done, total) => {
      // Progreso del batch (cada 10% o en cada tarea si DEBUG)
      const pct = Math.floor((done / total) * 100);
      if (DEBUG_IMAGES || pct >= lastProgressLog + 10 || done === total) {
        lastProgressLog = pct;
        log("info", "Progreso batch", { batchId, done, total, pct });
      }
    }
  );

  log("info", "Batch de imágenes finalizado", {
    batchId,
    took: ms(now() - tBatch0),
    ok: results.filter((r) => !r.error).length,
    fail: results.filter((r) => r.error).length,
  });

  return results;
}
