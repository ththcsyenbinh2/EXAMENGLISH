
import { createClient } from '@supabase/supabase-js';

// Hàm lấy biến môi trường an toàn, không cache để tránh lỗi nạp chậm
const getEnv = (key: string): string => {
  try {
    return (process.env as any)[key] || '';
  } catch {
    return '';
  }
};

export const isSupabaseConfigured = () => {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_ANON_KEY');
  return (
    url.length > 0 && 
    url.startsWith('https://') &&
    key.length > 20
  );
};

// Tạo một proxy client để luôn dùng giá trị mới nhất
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    const url = getEnv('SUPABASE_URL');
    const key = getEnv('SUPABASE_ANON_KEY');
    
    // Nếu chưa cấu hình, trả về một object rỗng để không crash render ban đầu
    if (!isSupabaseConfigured()) {
      return () => { console.warn("Supabase chưa được cấu hình!"); return { data: null, error: { message: 'Unconfigured' } }; };
    }

    const client = createClient(url, key);
    return (client as any)[prop];
  }
});
