// controllers/user.controller.ts
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export const getUsers = async () => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) return { success: false, error: error.message };
  return { success: true, users: data };
};

export const registerUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password, options:{ emailRedirectTo:'http://localhost:5173/auth/confirm' } });

  console.log(data,error);

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
    redirectTo: 'http://localhost:5173/',
  });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

export const updatePassword = async (newPassword: string) => {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: error.message };
  return { success: true, user: data.user };
};

export const verifyEmail = async (token: string) => {
  const { data, error } = await supabase.auth.verifyOtp({ token_hash:token,type: 'email' });
  if (error) return { success: false, error: error.message }; 
  return { success: true, user: data.user };
}

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


export const updatePasswordEmail = async (new_password: string, token_hash: string) => {
  // 1) Verifica el token de recuperación y obtiene sesión
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    type: 'recovery',
    token_hash,
  });

  if (verifyError) {
    return { success: false, error: verifyError.message };
  }

  // 2) Con la sesión activa, actualiza la contraseña
  const { data: updateData, error: updateError } = await supabase.auth.updateUser({
    password: new_password,
  });

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
};