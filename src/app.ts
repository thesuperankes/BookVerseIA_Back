// /src/app.ts
import { Elysia } from "elysia";
import routes from "./api/routes";
// import { logger } from "./utils/logger";
// import { errorHandler } from "./utils/errorHandler";
import { env } from "./config/env";

// Crear instancia del servidor
const app = new Elysia();

// Middlewares globales
// app.use(logger); // Logging personalizado (opcional)
app.onError(({ code, error }) => {
  console.log("Ocurrio un error")
});

// Rutas
app.use(routes);

// Escuchar en puerto definido en .env o por defecto 3000
const PORT = parseInt(env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});
