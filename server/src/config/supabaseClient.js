import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('❌ Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en las variables de entorno');
}

if (!supabaseServiceRoleKey) {
    throw new Error('❌ Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno');
}

// Cliente con permisos de usuario anónimo (respeta RLS) — usado solo para validar tokens.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente con permisos de servicio (ignora RLS) — usado por los controladores.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});
