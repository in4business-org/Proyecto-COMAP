import { createClient } from '@supabase/supabase-js';

// Usamos import.meta.env para leer variables de entorno en Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el frontend.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
