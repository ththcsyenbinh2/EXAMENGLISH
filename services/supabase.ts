
import { createClient } from '@supabase/supabase-js';

// Các biến này được nạp từ môi trường Vercel/System
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const checkSupabaseConfig = () => {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
};
