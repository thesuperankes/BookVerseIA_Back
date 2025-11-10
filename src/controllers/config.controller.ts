import { fromCSV, toCSV } from '../lib/jsonTool';
import { supabase } from '../lib/supabase';
import type { ConfigUpdateInput } from '../models/config.model';

const BUCKET = "stories-images";

export async function getChildAgeRange(userId: string) {
  const { data, error } = await supabase
    .from('config')
    .select('child_age_range')
    .eq('user_id', userId)
    .maybeSingle();

  return { data: data?.child_age_range ?? null, error };
}

/** Actualizar el rango de edad de un usuario */
export async function setChildAgeRange(userId: string, ageRange: number) {
  console.log("setChildAgeRange ->", userId, ageRange);

  const { data, error } = await supabase
    .from("config")
    .upsert(
      { user_id: userId, child_age_range: ageRange },
      { onConflict: "user_id" } // requiere unique index en user_id
    )
    .select("child_age_range")
    .single();

  return { data: data?.child_age_range ?? null, error };
}

export async function getChildThemes(userId: string) {
  const { data, error } = await supabase
    .from('config')
    .select('child_themes')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { data: null, error };

  const themes = data?.child_themes
    ? data.child_themes.split(',').map((t:any) => t.trim())
    : [];

  return { data: themes, error: null };
}

/** Guardar un array de temas (se convierte a string separado por comas) */
export async function setChildThemes(userId: string, themesArray: Array<string>) {
  const themesString = themesArray.join(',');
  const { data, error } = await supabase
    .from('config')
    .update({ child_themes: themesString })
    .eq('user_id', userId)
    .select('child_themes')
    .single();

  const result = data?.child_themes
    ? data.child_themes.split(',').map((t:any) => t.trim())
    : [];

  return { data: result, error };
}

export async function getConfig(userId: string) {
  const { data, error } = await supabase
    .from("config")
    .select("child_age_range, child_themes")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { data: null, error };

  // Normalizamos valores
  const age = data?.child_age_range ?? null;
  const themes = data?.child_themes
    ? data.child_themes.split(",").map((t: string) => t.trim())
    : [];

  // Armamos respuesta según lo que falte
  let result: any = {};

  console.log("age: " + age);
  console.log("themes: " + themes);

  if (age === null) {
    result.config = 'age';
  } else if (themes.length === 0 || themes == undefined || themes == null || themes.length < 1) {
    result.config = 'themes';
  }

  // completed depende de tener ambos llenos
  result.completed = age !== null && themes.length > 0;

  return { result, error: null };
}

export async function getFullConfig(userId: string) {
  const { data, error } = await supabase
    .from("config")
    .select(
      "child_age_range, child_themes, parent_pin, allowed_themes, blocked_themes"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { data: null, error };

  // Normalizamos cada campo
  const age = data?.child_age_range ?? null;

  const themes =
    data?.child_themes && data.child_themes.trim().length > 0
      ? data.child_themes.split(",").map((t: string) => t.trim())
      : [];

  const allowed =
    data?.allowed_themes && data.allowed_themes.trim().length > 0
      ? data.allowed_themes.split(",").map((t: string) => t.trim())
      : [];

  const blocked =
    data?.blocked_themes && data.blocked_themes.trim().length > 0
      ? data.blocked_themes.split(",").map((t: string) => t.trim())
      : [];

  const pin = data?.parent_pin ?? null;

  // Armamos la respuesta
  const result = {
    child_age_range: age,
    child_themes: themes,
    allowed_themes: allowed,
    blocked_themes: blocked,
    parent_pin: pin,
    completed: age !== null && themes.length > 0, // completed según tu lógica
  };

  return { result, error: null };
}

/**
 * Actualiza la tabla `config` del usuario. Si no existe fila, la crea.
 * Solo toca los campos que envíes en `payload` (parcial).
 * Devuelve la fila normalizada.
 */
export async function updateFullConfig(
  userId: string,
  payload: ConfigUpdateInput
): Promise<{
  result: {
    child_age_range: number | null;
    child_themes: string[];
    allowed_themes: string[];
    blocked_themes: string[];
    parent_pin: string | null;
    completed: boolean;
  } | null;
  error: any;
}> {
  console.log(payload);
  // 1) ¿Existe fila para este usuario?
  const { data: existing, error: selErr } = await supabase
    .from("config")
    .select("id, child_age_range, child_themes, allowed_themes, blocked_themes, parent_pin")
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr) return { result: null, error: selErr };

  // 2) Prepara el patch solo con campos presentes en payload
  const patch: Record<string, any> = {};
  if ("child_age_range" in payload) patch.child_age_range = payload.child_age_range ?? null;
  if ("parent_pin" in payload) patch.parent_pin = payload.parent_pin ?? null;

  if ("child_themes" in payload)
    patch.child_themes = toCSV(payload.child_themes);

  if ("allowed_themes" in payload)
    patch.allowed_themes = toCSV(payload.allowed_themes);

  if ("blocked_themes" in payload)
    patch.blocked_themes = toCSV(payload.blocked_themes);

  // 3) INSERT si no existe, UPDATE si existe
  let writeRes;
  if (existing) {
    writeRes = await supabase
      .from("config")
      .update(patch)
      .eq("user_id", userId)
      .select("child_age_range, child_themes, allowed_themes, blocked_themes, parent_pin")
      .single();
  } else {
    writeRes = await supabase
      .from("config")
      .insert([{ user_id: userId, ...patch }])
      .select("child_age_range, child_themes, allowed_themes, blocked_themes, parent_pin")
      .single();
  }

  if (writeRes.error) return { result: null, error: writeRes.error };

  const row = writeRes.data;

  // 4) Normaliza para retornar igual que getFullConfig
  const age = row?.child_age_range ?? null;
  const themes = fromCSV(row?.child_themes);
  const allowed = fromCSV(row?.allowed_themes);
  const blocked = fromCSV(row?.blocked_themes);
  const pin = row?.parent_pin ?? null;

  const result = {
    child_age_range: age,
    child_themes: themes,
    allowed_themes: allowed,
    blocked_themes: blocked,
    parent_pin: pin,
    completed: age !== null && themes.length > 0,
  };

  return { result, error: null };
}

export async function verifyParentPin(userId: string, pin: string) {
  const { data, error } = await supabase
    .from("config")
    .select("parent_pin")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error };

  if (!data || !data.parent_pin) {
    return { ok: false, error: "No existe un PIN configurado" };
  }

  const isValid = String(data.parent_pin) === String(pin);

  return {
    ok: isValid,
    error: isValid ? null : "PIN incorrecto",
  };
}

export async function setParentPin(userId: string, pin: string) {
  // 1) Verificar si existe fila
  const { data: existing, error: selErr } = await supabase
    .from("config")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr) return { ok: false, error: selErr };

  if (existing) {
    // 2a) Update
    const { data, error } = await supabase
      .from("config")
      .update({ parent_pin: pin })
      .eq("user_id", userId)
      .select("parent_pin")
      .single();

    if (error) return { ok: false, error };
    return { ok: true, data: data?.parent_pin ?? null, error: null };
  } else {
    // 2b) Insert
    const { data, error } = await supabase
      .from("config")
      .insert({ user_id: userId, parent_pin: pin })
      .select("parent_pin")
      .single();

    if (error) return { ok: false, error };
    return { ok: true, data: data?.parent_pin ?? null, error: null };
  }
}
