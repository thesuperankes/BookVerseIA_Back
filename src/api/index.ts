// /api/index.ts
import { Elysia } from "elysia";
import routes from "./routes";
// import { logger } from "../utils/logger";
// import { errorHandler } from "../utils/errorHandler";

const app = new Elysia();

// Middleware globales
app.onError(({ code, error }) => {
    console.log("Parece que ocurrio un error jsjsjs")
//   errorHandler(code, error);
});

// app.use(logger); // Logger personalizado
app.use(routes); // Todas las rutas

// Iniciar servidor
app.listen(3000, () => {
  console.log("🚀 Backend escuchando en http://localhost:3000");
});
