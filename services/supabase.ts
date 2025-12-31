
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Sử dụng URL giả lập nếu chưa có cấu hình để tránh crash ngay lập tức
const placeholderUrl = 'https://placeholder-project.supabase.co';
const placeholderKey = 'placeholder-key';

export const supabase = createClient(
  SUPABASE_URL || placeholderUrl,
  SUPABASE_ANON_KEY || placeholderKey
);

export const isSupabaseConfigured = () => !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
export const isApiKeyConfigured = () => !!process.env.API_KEY;
