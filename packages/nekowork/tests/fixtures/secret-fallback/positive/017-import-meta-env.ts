// positive: Vite import.meta.env with hardcoded fallback (ships to browser)

export const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'public-anon-fallback-key';
