
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env as any).SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = (process.env as any).SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * CẬP NHẬT CẤU TRÚC BẢNG TRÊN SUPABASE SQL EDITOR:
 * 
 * -- 1. Bảng đề thi (Thêm exam_code và is_open)
 * CREATE TABLE exams (
 *   id TEXT PRIMARY KEY,
 *   exam_code TEXT UNIQUE NOT NULL,
 *   title TEXT NOT NULL,
 *   questions JSONB NOT NULL,
 *   is_open BOOLEAN DEFAULT FALSE,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 2. Bảng kết quả (Thêm class_name)
 * CREATE TABLE submissions (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   exam_id TEXT REFERENCES exams(id),
 *   student_name TEXT NOT NULL,
 *   class_name TEXT NOT NULL,
 *   score INT NOT NULL,
 *   total INT NOT NULL,
 *   answers JSONB NOT NULL,
 *   time_spent INT NOT NULL,
 *   submitted_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */
