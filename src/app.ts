// /src/app.ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";

import routes from "./api/routes";
// import { logger } from "./utils/logger";
// import { errorHandler } from "./utils/errorHandler";
import { env } from "./config/env";
import * as path from "node:path";


// Crear instancia del servidor
const app = new Elysia();
const ASSETS_DIR = process.env.ASSETS_DIR || path.join(process.cwd(), "assets");


app.use(
  cors({
    origin: ["http://localhost:5173"], // o ["*"] si estás en desarrollo
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type",'authorization'],

  })
);

app.get("/assets/*", async ({ params, set }) => {
  const rel = params["*"];                      // ej: "abc/scene-1.png"
  const filePath = path.join(ASSETS_DIR, rel);  // assets/abc/scene-1.png
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    set.status = 404;
    return "Not Found";
  }

  // Bun detecta el tipo MIME automáticamente
  set.headers["Content-Type"] = file.type || "application/octet-stream";
  return file;
});

// Middlewares globales
// app.use(logger); // Logging personalizado (opcional)
app.onError(({ code, error }) => {
  console.log("Ocurrio un error" + error)
});

// Rutas
app.use(routes);

// Escuchar en puerto definido en .env o por defecto 3000
const PORT = parseInt(env.PORT || "3000", 10);

console.info("Servidor iniciando", { port: 3000, assetsDir: ASSETS_DIR, assetsPrefix: "/assets" });


app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});
