


interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GEMINI_API_KEY: string; // Added this line
  // Add other environment variables here as your project grows
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}