
export type QuestionType = 'mcq' | 'essay';

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[]; // Chỉ dành cho MCQ
  correctAnswerIndex?: number; // Chỉ dành cho MCQ
  sampleAnswer?: string; // Đáp án gợi ý cho Tự luận
}

export interface Exam {
  id: string;
  exam_code: string;
  title: string;
  questions: Question[];
  is_open: boolean;
  created_at: string;
}

export interface StudentSubmission {
  id: string;
  exam_id: string;
  student_name: string;
  class_name: string;
  answers: Record<string, any>; // Lưu index (MCQ) hoặc string (Essay)
  score: number;
  total: number;
  submitted_at: string;
  time_spent: number;
}

export enum AppMode {
  TEACHER_DASHBOARD = 'teacher',
  EXAM_SETUP = 'setup',
  STUDENT_ENTRY = 'entry',
  STUDENT_EXAM = 'exam',
  STUDENT_RESULT = 'result',
  VIEW_SUBMISSIONS = 'view_submissions'
}
