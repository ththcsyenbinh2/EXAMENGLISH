
import { createClient } from '@supabase/supabase-js';

// Hàm lấy cấu hình từ nhiều nguồn theo thứ tự ưu tiên
export const getSupabaseConfig = () => {
  let url = '';
  let key = '';

  try {
    // 1. Ưu tiên cao nhất: Lấy từ URL (Portable Setup Link)
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('s_url');
    const keyParam = params.get('s_key');

    if (urlParam && keyParam) {
      url = decodeURIComponent(urlParam);
      key = decodeURIComponent(keyParam);
      // Tự động lưu vào máy để lần sau không cần URL nữa
      localStorage.setItem('ST_SUPABASE_URL', url);
      localStorage.setItem('ST_SUPABASE_ANON_KEY', key);
      
      // Xóa params trên URL cho sạch sẽ và bảo mật
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    } else {
      // 2. Thử lấy từ process.env (Dành cho bản Deploy chính thức)
      url = (process.env as any).SUPABASE_URL || '';
      key = (process.env as any).SUPABASE_ANON_KEY || '';

      // 3. Cuối cùng mới lấy từ localStorage
      if (!url || !key) {
        url = localStorage.getItem('ST_SUPABASE_URL') || '';
        key = localStorage.getItem('ST_SUPABASE_ANON_KEY') || '';
      }
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

export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    const { url, key } = getSupabaseConfig();
    
    if (!isSupabaseConfigured()) {
      return () => {
        console.warn("Supabase chưa được cấu hình!");
        return { data: null, error: { message: 'Hệ thống chưa kết nối Cloud. Vui lòng thiết lập trong Cài đặt.' } };
      };
    }

    const client = createClient(url, key);
    return (client as any)[prop];
  }
});
