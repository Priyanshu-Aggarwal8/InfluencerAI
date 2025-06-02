// services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// --- Hardcoded fallback values - FOR LOCAL TESTING ONLY ---
// WARNING: Do not commit these directly to your repository if it's public.
// It's better to use environment variables for production.
const FALLBACK_SUPABASE_URL = "https://uvenhewnicmpgxqhtcfd.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2ZW5oZXduaWNtcGd4cWh0Y2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3ODA3MDcsImV4cCI6MjA2NDM1NjcwN30.-e97RGlYLXjzBzWcy23TXb3XLiMffYTD7e-26ayhnlY";
// --- End of hardcoded values ---

let supabaseUrl: string | undefined;
let supabaseAnonKey: string | undefined;

if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
}

if (!supabaseUrl) {
  console.warn(
    "Warning: VITE_SUPABASE_URL not found in environment variables or import.meta.env is undefined. " +
    "Falling back to hardcoded URL for local testing. " +
    "For development/production, ensure Vite is running and .env.local is configured."
  );
  supabaseUrl = FALLBACK_SUPABASE_URL;
}

if (!supabaseAnonKey) {
  console.warn(
    "Warning: VITE_SUPABASE_ANON_KEY not found in environment variables or import.meta.env is undefined. " +
    "Falling back to hardcoded anon key for local testing. " +
    "For development/production, ensure Vite is running and .env.local is configured."
  );
  supabaseAnonKey = FALLBACK_SUPABASE_ANON_KEY;
}

if (!supabaseUrl) {
  throw new Error(
    "CRITICAL Configuration Error: Supabase URL is not defined. " +
    "This should not happen if fallbacks are set. Please check supabaseClient.ts."
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "CRITICAL Configuration Error: Supabase Anon Key is not defined. " +
    "This should not happen if fallbacks are set. Please check supabaseClient.ts."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);