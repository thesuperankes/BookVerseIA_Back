// /api/routes/story.routes.ts
import { Elysia } from "elysia";
import { createFinalAct,createGamification,createRecommendations,createStickerDescription,createStoryAct2,createStoryElements,startStory,testStory } from "../../controllers/story.controller";

const storyRoutes = new Elysia();

storyRoutes.group("/story", (app) => {
  return app
    .post("/final-act", createFinalAct)
    .post("/gamification", createGamification)
    .post("/recommendations", createRecommendations)
    .post("/sticker-description", createStickerDescription)
    .post("/act2", createStoryAct2)
    .post("/elements", createStoryElements)
    .get("/test", testStory)
    .post("/introduction", startStory);

});

export default storyRoutes;
