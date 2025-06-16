// controllers/user.controller.ts
import { supabase } from '../lib/supabase';

export const getUsers = async () => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) return { success: false, error: error.message };
  return { success: true, users: data };
};

export const registerUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

export const loginUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true, session: data.session, user: data.user };
};

export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const sendPasswordResetEmail = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://tu-app.com/reset-password',
  });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

export const updatePassword = async (newPassword: string) => {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: error.message };
  return { success: true, user: data.user };
};

export const deactivateAccount = async () => {
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError || !user) {
    return { success: false, error: getUserError?.message || 'User not found' };
  }

  const { error } = await supabase.from('users').update({ active: false }).eq('id', user.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
};
