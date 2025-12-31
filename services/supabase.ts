
import { createClient } from '@supabase/supabase-js';

// Hàm lấy cấu hình từ nhiều nguồn theo thứ tự ưu tiên
export const getSupabaseConfig = () => {
  let url = '';
  let key = '';

  try {
    // 1. Kiểm tra URL Params trước (Dành cho máy học sinh mới mở link)
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('s_url');
    const keyParam = params.get('s_key');

    if (urlParam && keyParam) {
      url = decodeURIComponent(urlParam);
      key = decodeURIComponent(keyParam);
      
      // Lưu ngay vào máy để các lần tải sau không cần params nữa
      localStorage.setItem('ST_SUPABASE_URL', url);
      localStorage.setItem('ST_SUPABASE_ANON_KEY', key);
    } else {
      // 2. Nếu không có ở URL, lấy từ localStorage
      url = localStorage.getItem('ST_SUPABASE_URL') || '';
      key = localStorage.getItem('ST_SUPABASE_ANON_KEY') || '';
      
      // 3. Cuối cùng mới lấy từ process.env (nếu có)
      if (!url || !key) {
        url = (process.env as any).SUPABASE_URL || '';
        key = (process.env as any).SUPABASE_ANON_KEY || '';
      }
    }
  } catch (e) {
    console.error("Lỗi cấu hình Supabase:", e);
  }

  return { url, key };
};

export const isSupabaseConfigured = () => {
  const { url, key } = getSupabaseConfig();
  return url.length > 0 && key.length > 20;
};

// Khởi tạo client một cách an toàn
let supabaseInstance: any = null;

export const getSupabaseClient = () => {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  if (!supabaseInstance) {
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
};

// Proxy để sử dụng như biến supabase thông thường nhưng an toàn hơn
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    const client = getSupabaseClient();
    if (!client) {
      return () => {
        console.warn("Chưa cấu hình Supabase");
        return { data: null, error: { message: 'Cloud disconnected' } };
      };
    }
    return (client as any)[prop];
  }
});
