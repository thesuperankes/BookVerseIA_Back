import { supabase } from '../lib/supabase';
// /controllers/story.controller.ts
export const getUser = async ({ }: any) => {
    const { data, error } = await supabase.from('users').select('*');

    if (error) {
        return {
            success: false,
            error: error.message,
        };
    }

    return {
        success: true,
        users: data,
    };
};
