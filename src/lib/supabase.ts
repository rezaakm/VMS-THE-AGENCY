import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Keep the user signed in across reloads, tabs, and browser restarts.
    persistSession: true,
    // Silently refresh the access token in the background so the session
    // stays alive for weeks without forcing a re-login.
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Stable, app-specific storage key so the session is not lost if other
    // Supabase apps on related origins use the default key.
    storageKey: "agency-os-auth",
  },
});
