
import { createClient } from '@supabase/supabase-js';

// Hàm lấy cấu hình từ nhiều nguồn: process.env -> localStorage
export const getSupabaseConfig = () => {
  let url = '';
  let key = '';

  try {
    // 1. Thử lấy từ process.env (Vercel/Build time)
    url = (process.env as any).SUPABASE_URL || '';
    key = (process.env as any).SUPABASE_ANON_KEY || '';

    // 2. Nếu trống, thử lấy từ localStorage (Runtime setup)
    if (!url || !key) {
      url = localStorage.getItem('ST_SUPABASE_URL') || '';
      key = localStorage.getItem('ST_SUPABASE_ANON_KEY') || '';
    }
  } catch (e) {
    console.error("Lỗi khi đọc cấu hình:", e);
  }

  return { url, key };
};

export const isSupabaseConfigured = () => {
  const { url, key } = getSupabaseConfig();
  return (
    url.length > 0 && 
    url.startsWith('https://') &&
    key.length > 20
  );
};

// Cấu hình Proxy để khởi tạo client linh hoạt
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    const { url, key } = getSupabaseConfig();
    
    if (!isSupabaseConfigured()) {
      return () => {
        console.warn("Supabase chưa được cấu hình!");
        return { data: null, error: { message: 'Chưa cấu hình Database. Vui lòng thiết lập trong phần Cài đặt.' } };
      };
    }

    const client = createClient(url, key);
    return (client as any)[prop];
  }
});
