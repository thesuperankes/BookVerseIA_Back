import { Elysia } from "elysia";
import { generateInteractiveStoryHandler } from "../../controllers/story.controller";

const interactiveRoutes = new Elysia();

interactiveRoutes.group("/story", (app) => {
  return app.post("/introduction", generateInteractiveStoryHandler);
});

export default interactiveRoutes;
