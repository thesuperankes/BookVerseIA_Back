// /api/routes/story.routes.ts
import { Elysia } from "elysia";
import { getUser } from "../../controllers/user.controller";

const userRoutes = new Elysia();

userRoutes.group("/users", (app) => {
  return app
    .get("/users", getUser)
});

export default userRoutes;
