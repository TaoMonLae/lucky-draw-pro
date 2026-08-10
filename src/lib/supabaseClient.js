import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY?.trim();

let configuredClient = null;

if (supabaseUrl && supabasePublishableKey) {
  try {
    configuredClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  } catch (error) {
    console.error('Supabase configuration is invalid', error);
  }
}

export const supabase = configuredClient;
export const isSupabaseConfigured = Boolean(configuredClient);
