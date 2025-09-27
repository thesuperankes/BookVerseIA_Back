// /api/routes/story.routes.ts
import { Elysia } from "elysia";
import { checkStory, getStoryCards, getStoryRawPayload, startStory, testStory, upsertStory } from "../../controllers/story.controller";
import { secure } from "../../middleware/secure";

const storyRoutes = new Elysia();

storyRoutes.group("/story", (app) => {
  return app
    .get("/test", testStory)
    .post("/introduction", secure(async ({ user, body }: { user: any; body: any }) => {
      const userId = user.id;
      const result = await startStory({ userId, body });
      try {
        let res = await upsertStory(userId, result.story);
        console.log(res);
      } catch (e) {
        console.log("No se pudo almacenar la historia: ", e);
      }

      return result;
    }))
    .post("/testStory", checkStory)
    .post("/stories/upsert",
      secure(async ({ user, body }: { user: any; body: any }) => {
        // Validación básica: body debe tener story.id
        if (!body?.story?.id) {
          return {
            status: 400,
            body: { ok: false, error: "El payload debe contener story.id" },
          };
        }

        // Guardar o actualizar historia
        const { ok, data, error } = await upsertStory(user.id, body);

        if (!ok || error) {
          return {
            status: 500,
            body: { ok: false, error: error?.message ?? "Error interno" },
          };
        }

        return {
          status: 200,
          body: { ok: true, story: data },
        };
      }))
    .post("/cards", secure(async ({ user, body }: { user: any, body: any }) => {
      const from = Number.isFinite(body?.from) ? Number(body.from) : 0;
      const to = Number.isFinite(body?.to) ? Number(body.to) : from + 19;

      const { data, error } = await getStoryCards({ from, to });
      if (error) return { status: 500, body: { ok: false, error: error.message ?? "Error" } };

      return { status: 200, body: { ok: true, items: data } };
    }))
    .post("/get-story", secure(async ({ user, body }: { user: any; body: any }) => {
      
      const storyId = JSON.parse(body).storyId;

      console.log(storyId);

      if (storyId == null || storyId === "") {
        return { status: 400, body: { ok: false, error: "id (storyId) requerido" } };
      }

      const { data, error } = await getStoryRawPayload(user.id, storyId);

      if (error) {
        const msg = error.message || "Error obteniendo raw_payload";
        const code = msg === "Not found" ? 404 : msg === "Forbidden" ? 403 : 500;
        return { status: code, body: { ok: false, error: msg } };
      }

      return { status: 200, body: { ok: true, raw_payload: data } };
    })
    );

});

export default storyRoutes;
