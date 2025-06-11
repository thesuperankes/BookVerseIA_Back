// /api/routes/story.routes.ts
import { Elysia } from "elysia";
import { generateStory, testStory, getSuggestedStories, createStoryAct1, createImage } from "../../controllers/story.controller";

const storyRoutes = new Elysia();

storyRoutes.group("/story", (app) => {
  return app
    .post("/generate", generateStory)
    .get("/test", testStory)
    .post("/suggest", getSuggestedStories)
    .post("/generate-act1", createStoryAct1)
    .post("/generate-image", createImage);
});

export default storyRoutes;
