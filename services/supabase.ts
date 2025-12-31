
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Khởi tạo client. Nếu thiếu URL, các lệnh gọi sẽ lỗi nhưng app không bị trắng trang.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co', 
  SUPABASE_ANON_KEY || 'placeholder'
);

export const isConfigured = () => !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
