
export interface Question {
  id: string;
  prompt: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface Exam {
  id: string;
  exam_code: string;
  title: string;
  description: string;
  questions: Question[];
  is_open: boolean;
  created_at: string;
}

export interface StudentSubmission {
  id: string;
  examId: string;
  studentName: string;
  className: string;
  answers: Record<string, number>;
  score: number;
  total: number;
  submittedAt: number;
  timeSpent: number;
}

export enum AppMode {
  TEACHER_DASHBOARD = 'teacher',
  EXAM_SETUP = 'setup',
  STUDENT_ENTRY = 'entry',
  STUDENT_EXAM = 'exam',
  STUDENT_RESULT = 'result',
  VIEW_SUBMISSIONS = 'view_submissions'
}
