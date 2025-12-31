
import { createClient } from '@supabase/supabase-js';

// Hàm lấy biến môi trường an toàn cho trình duyệt
const getEnvVar = (name: string): string => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name] as string;
    }
    // Fallback cho một số môi trường đặc thù
    return (window as any)._env_?.[name] || '';
  } catch (e) {
    return '';
  }
};

const SUPABASE_URL = getEnvVar('SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnvVar('SUPABASE_ANON_KEY');

// Sử dụng placeholder để không crash nếu biến chưa kịp nạp, 
// nhưng vẫn đảm bảo app render được UI
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder-project.supabase.co', 
  SUPABASE_ANON_KEY || 'placeholder-key'
);

export const isSupabaseConfigured = () => {
  return !!SUPABASE_URL && SUPABASE_URL !== 'https://placeholder-project.supabase.co';
};
