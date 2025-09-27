// src/services/settings.ts
import type { User } from '@supabase/supabase-js';

export async function ensureUserSettings(sb: ReturnType<typeof import('../lib/supabase').supabaseAs>, userId: string) {
  // Upsert bajo RLS (el usuario sólo puede tocar su fila)
  await sb
    .from('settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
}
