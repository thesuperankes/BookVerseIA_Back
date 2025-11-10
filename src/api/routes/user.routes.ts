// /api/routes/story.routes.ts
import { Elysia } from "elysia";
import {
  registerUser,
  loginUser,
  logoutUser,
  sendPasswordResetEmail,
  updatePassword,
  deactivateAccount,
  verifyEmail,
  updatePasswordEmail,
} from "../../controllers/user.controller";

import type {
  LoginUserBody,
  RegisterUserBody,
  ResetPasswordBody,
  UpdatePasswordBody,
} from "../../types/user.types";
import { secure } from "../../middleware/secure";


const userRoutes = new Elysia();

userRoutes.group("/users", (app) =>
  app
    .post("/register", async ({ body }: { body: RegisterUserBody }) => {
      const { email, password } = body;
      return await registerUser(email, password);
    })
    .post("/login", async ({ body }: { body: LoginUserBody }) => {
      const { email, password } = body;
      return await loginUser(email, password);
    })
    .post("/logout", async () => {
      return await logoutUser();
    })
    .post("/reset-password", async ({ body }: { body: ResetPasswordBody }) => {
      const { email } = body;
      return await sendPasswordResetEmail(email);
    })
    .post(
      "/update-password",
      async ({ body }: { body: UpdatePasswordBody }) => {
        const { newPassword } = body;
        return await updatePassword(newPassword);
      }
    )
    .post("/deactivate", async () => {
      return await deactivateAccount();
    })
    .post("/verifyEmail", async ({ body }: { body: any }) => {
      const { token } = body;
      return await verifyEmail(token);
    })
    .post("/new-password", async ({ body }: { body: any }) => {
      console.log(body);
      const { new_password, token_hash } = body;
      console.log(new_password);
      return await updatePasswordEmail(new_password, token_hash);
    })
    .get('/me', secure(async ({ user, sb }) => {
      const { data: settings } = await sb.from('settings').select('*').eq('user_id', user.id).maybeSingle();
      return { success: true, user, settings };
    }))
);

export default userRoutes;
