import { supabase } from '../lib/supabase';

export const getStorageObjects = async (bucket: string, path: string) => {
  const { data, error } = await supabase.storage.from(bucket).list(path);
  if (error) return { success: false, error: error.message };
  return { success: true, objects: data };
};