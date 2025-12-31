
import { createClient } from '@supabase/supabase-js';

// Truy cập trực tiếp để trình đóng gói (bundler) có thể thay thế giá trị
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || SUPABASE_URL === 'https://your-project.supabase.co') {
  console.warn("Supabase URL is missing or default. Please ensure Environment Variables are set in Vercel.");
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co', 
  SUPABASE_ANON_KEY || 'placeholder'
);
