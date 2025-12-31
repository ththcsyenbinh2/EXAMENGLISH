
import { createClient } from '@supabase/supabase-js';

// Dùng cơ chế fallback an toàn để tránh lỗi ReferenceError: process is not defined
const getEnv = (key: string): string => {
  try {
    // Thử lấy từ process.env (Vercel inject khi build)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {}
  
  // @ts-ignore
  return window[key] || ''; 
};

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || SUPABASE_URL.includes('placeholder')) {
  console.error("CRITICAL: SUPABASE_URL is missing! Kiểm tra lại Environment Variables trên Vercel.");
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co', 
  SUPABASE_ANON_KEY || 'placeholder'
);
