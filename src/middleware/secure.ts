// src/auth/secure.ts
import type { Context } from 'elysia';
import { supabase, supabaseAs } from '../lib/supabase';

type Handler = (ctx: Context & { user: any; sb: ReturnType<typeof supabaseAs>; accessToken: string }) => any;

export function secure(handler: Handler) {
  return async (ctx: Context) => {
    const h = ctx.request.headers.get('authorization') ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : (ctx.cookie as any)?.access_token?.value;

    if (!token) {
      ctx.set.status = 401;
      return { success: false, error: 'No token' };
    }

    // Valida token
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      ctx.set.status = 401;
      return { success: false, error: 'Invalid token' };
    }

    const sb = supabaseAs(token);
    // Ejecuta el handler “seguro”
    return handler(Object.assign(ctx, { user: data.user, sb, accessToken: token }) as any);
  };
}
