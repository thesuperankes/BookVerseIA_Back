// /api/routes.ts
import { Elysia } from "elysia";
import userRoutes from "./routes/user.routes";
import storyRoutes from "./routes/story.routes";
import configRoutes from "./routes/config.routes";

const routes = new Elysia();

routes.group("/api", (app) => 
  app
    .use(userRoutes)
    .use(storyRoutes)
    .use(configRoutes)
);

export default routes;
