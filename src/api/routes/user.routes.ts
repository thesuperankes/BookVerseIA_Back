// /api/routes/story.routes.ts
import { Elysia } from 'elysia';
import {
  getUsers,
  registerUser,
  loginUser,
  logoutUser,
  sendPasswordResetEmail,
  updatePassword,
  deactivateAccount
} from '../../controllers/user.controller';
import type { LoginUserBody, RegisterUserBody, ResetPasswordBody, UpdatePasswordBody } from '../../types/user.types';

const userRoutes = new Elysia();

userRoutes.group('/users', (app) =>
  app
    .post('/register', async ({ body } : { body:RegisterUserBody }) => {
      const { email, password } = body;
      return await registerUser(email, password);
    })
    .post('/login', async ({ body }:{ body:LoginUserBody }) => {
      const { email, password } = body;
      return await loginUser(email, password);
    })
    .post('/logout', async () => {
      return await logoutUser();
    })
    .post('/reset-password', async ({ body } : { body:ResetPasswordBody }) => {
      const { email } = body;
      return await sendPasswordResetEmail(email);
    })
    .post('/update-password', async ({ body }: { body: UpdatePasswordBody }) => {
      const { newPassword } = body;
      return await updatePassword(newPassword);
    })
    .post('/deactivate', async () => {
      return await deactivateAccount();
    })
);

export default userRoutes;
