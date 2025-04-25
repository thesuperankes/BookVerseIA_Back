// /api/routes/story.routes.ts
import { Elysia } from "elysia";
import { generateStory, testStory } from "../../controllers/story.controller";

const storyRoutes = new Elysia();

storyRoutes.group("/story", (app) => {
  return app
    .post("/generate", generateStory)
    .get("/test", testStory);
});

export default storyRoutes;
