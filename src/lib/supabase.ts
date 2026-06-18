import { createClient } from '@supabase/supabase-js';

// Centralized safe client initialization using standard import.meta.env
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://placeholder-your-project.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key-please-insert-in-env';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
