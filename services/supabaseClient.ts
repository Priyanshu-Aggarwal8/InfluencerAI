// services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

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
}

if (!supabaseAnonKey) {
  console.warn(
    "Warning: VITE_SUPABASE_ANON_KEY not found in environment variables or import.meta.env is undefined. " +
    "Falling back to hardcoded anon key for local testing. " +
    "For development/production, ensure Vite is running and .env.local is configured."
  );
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