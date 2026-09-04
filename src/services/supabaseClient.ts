import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase Client Warning]: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. Please configure them in your .env or Netlify settings.'
  );
}

// Browser-side Supabase client with persistent sessions
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'project_sentinel_auth_session',
  },
});
