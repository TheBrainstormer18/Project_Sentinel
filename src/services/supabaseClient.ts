import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isClientSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('your-project-ref')
);

if (!isClientSupabaseConfigured) {
  console.warn(
    '[Supabase Client]: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not configured. Please set them in your .env or Netlify Environment Variables.'
  );
}

// Browser-side Supabase client with persistent sessions
export const supabase = createClient(
  isClientSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isClientSupabaseConfigured ? supabaseAnonKey : 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'project_sentinel_auth_session',
    },
  }
);
