
import React, { useState, useEffect, useMemo } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, ChevronRight, Loader2, Trash2, 
  Trophy, Clock, Users, ArrowLeft, Download, Database,
  Lock, Unlock, Search, UserCircle, School, BarChart3, PieChart,
  AlertTriangle, TrendingUp, Copy, CheckCircle2, FileSpreadsheet
} from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TEACHER_DASHBOARD);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  
  // Student State
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [examCodeInput, setExamCodeInput] = useState('');
  const [studentAnswers, setStudentAnswers] = useState<Record<string, number>>({});
  const [currentSubmission, setCurrentSubmission] = useState<StudentSubmission | null>(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (isSupabaseConfigured()) {
      fetchExams();
    }
    if (window.location.hash === '#hocsinh') {
      setMode(AppMode.STUDENT_ENTRY);
    }
  }, []);

  useEffect(() => {
    let interval: any;
    if (mode === AppMode.STUDENT_EXAM) {
      interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [mode]);

  const fetchExams = async () => {
    if (!isSupabaseConfigured()) return;
    setIsDbLoading(true);
    try {
      const { data: exData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      if (exData) setExams(exData);
      const { data: subData } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
      if (subData) setSubmissions(subData);
    } catch (e) {
      console.error("Lỗi kết nối database:", e);
    } finally {
      setIsDbLoading(false);
    }
  };

  const classStats = useMemo(() => {
    if (!currentExam) return [];
    const examSubmissions = submissions.filter(s => (s as any).exam_id === currentExam.id);
    const statsMap: Record<string, any> = {};

    examSubmissions.forEach((s: any) => {
      const cls = s.class_name || "Chưa phân lớp";
      if (!statsMap[cls]) {
        statsMap[cls] = { className: cls, count: 0, totalScore: 0, maxScore: 0, minScore: 10, students: [] };
      }
      statsMap[cls].count++;
      statsMap[cls].totalScore += s.score;
      statsMap[cls].maxScore = Math.max(statsMap[cls].maxScore, s.score);
      statsMap[cls].minScore = Math.min(statsMap[cls].minScore, s.score);
      statsMap[cls].students.push(s);
    });
    return Object.values(statsMap).sort((a, b) => a.className.localeCompare(b.className));
  }, [submissions, currentExam]);

  const generateExamCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setLoadingStep('Đang đọc file Word...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Assume mammoth is available globally
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      setLoadingStep('AI đang bóc tách câu hỏi...');
      const extracted = await extractQuestionsFromText(result.value);
      const newExam: Exam = {
        id: Math.random().toString(36).substring(2, 11),
        exam_code: generateExamCode(),
        title: extracted.title,
        description: `Tạo từ ${file.name}`,
        questions: extracted.questions,
        is_open: false,
        created_at: new Date().toISOString()
      };
      setCurrentExam(newExam);
      setMode(AppMode.EXAM_SETUP);
    } catch (error: any) {
      alert(`Lỗi: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Main UI Render
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-800 flex items-center gap-2">
          <GraduationCap size={36} /> ExamGenius AI
        </h1>
        {isDbLoading && <Loader2 className="animate-spin text-blue-600" />}
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        {mode === AppMode.TEACHER_DASHBOARD && (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-semibold mb-6">Quản lý Đề thi</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-blue-500 cursor-pointer transition flex flex-col items-center gap-4">
                <Plus size={48} className="text-blue-500" />
                <span className="text-lg font-medium">Tạo đề thi mới (.docx)</span>
                <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="p-20 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="text-xl font-medium text-gray-700">{loadingStep}</p>
          </div>
        )}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="p-8">
            <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="flex items-center gap-2 text-blue-600 mb-6 hover:underline">
              <ArrowLeft size={20} /> Quay lại
            </button>
            <h2 className="text-2xl font-bold mb-2">{currentExam.title}</h2>
            <p className="text-gray-500 mb-6">Mã đề: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{currentExam.exam_code}</span></p>
            
            <div className="space-y-6">
              {currentExam.questions.map((q, idx) => (
                <div key={q.id} className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-semibold text-lg mb-4">{idx + 1}. {q.prompt}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className={`p-3 rounded border ${oIdx === q.correctAnswerIndex ? 'bg-green-100 border-green-500 font-bold' : 'bg-white border-gray-300'}`}>
                        {String.fromCharCode(65 + oIdx)}. {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// Default export is required by index.tsx
export default App;
