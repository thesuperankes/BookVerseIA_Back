// /api/routes/story.routes.ts
import { Elysia } from "elysia";
import { startStory,testStory } from "../../controllers/story.controller";

const storyRoutes = new Elysia();

storyRoutes.group("/story", (app) => {
  return app
    .get("/test", testStory)
    .post("/introduction", startStory);

});

export default storyRoutes;
