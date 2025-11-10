import { supabase } from '../lib/supabase';

/**
 * Sube una imagen en base64 al bucket indicado y retorna su public URL.
 * El path es relativo al bucket (ej: "stories/<storyId>/<fname>.png")
 */
export const uploadBase64Image = async ({
  bucket = 'stories-images',
  path,
  b64,
  contentType = 'image/png',
}: {
  bucket?: string;
  path: string;
  b64: string;
  contentType?: string;
}) => {
  // Limpia prefijo data URL si existe
  const base64 = b64.replace(/^data:\w+\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  const { data, error } = await supabase
    .storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) {
    return { ok: false as const, error };
  }

  const { data: pub } = supabase
    .storage
    .from(bucket)
    .getPublicUrl(path);

  return {
    ok: true as const,
    path, // ruta "interna" dentro del bucket
    url: pub.publicUrl, // URL pública lista para usar en el front
  };
};

export const getStorageObjects = async (bucket: string, path: string) => {
  const { data, error } = await supabase.storage.from(bucket).list(path);
  if (error) return { success: false, error: error.message };
  return { success: true, objects: data };
};