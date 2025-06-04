// /api/routes.ts
import { Elysia } from "elysia";
// import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import storyRoutes from "./routes/story.routes";
// import gameRoutes from "./routes/game.routes";
// import adminRoutes from "./routes/admin.routes";

const routes = new Elysia();

routes.group("/api", (app) => 
  app
    // .use(authRoutes)
    .use(userRoutes)
    .use(storyRoutes)
    // .use(gameRoutes)
    // .use(adminRoutes)
);

export default routes;
