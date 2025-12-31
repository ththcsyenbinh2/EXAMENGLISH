
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  try {
    return (process.env as any)[key] || '';
  } catch {
    return '';
  }
};

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

// Kiểm tra cấu hình có đầy đủ và hợp lệ không
export const isSupabaseConfigured = () => {
  return (
    typeof SUPABASE_URL === 'string' && 
    SUPABASE_URL.startsWith('https://') &&
    typeof SUPABASE_ANON_KEY === 'string' && 
    SUPABASE_ANON_KEY.length > 20
  );
};

// Khởi tạo client - Sử dụng URL giả lập nếu chưa có cấu hình để tránh crash render
export const supabase = createClient(
  isSupabaseConfigured() ? SUPABASE_URL : 'https://placeholder.supabase.co', 
  isSupabaseConfigured() ? SUPABASE_ANON_KEY : 'placeholder'
);
