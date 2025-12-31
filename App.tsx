
import React, { useState, useEffect, useMemo } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText } from './services/geminiService';
import { supabase, checkSupabaseConfig } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, ChevronRight, Loader2, Trash2, 
  Trophy, Clock, Users, ArrowLeft, Database,
  Lock, Unlock, UserCircle, School, BarChart3, PieChart,
  CheckCircle2, LayoutDashboard, FileText, ClipboardList
} from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TEACHER_DASHBOARD);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  
  // Student State
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [examCodeInput, setExamCodeInput] = useState('');
  const [studentAnswers, setStudentAnswers] = useState<Record<string, number>>({});
  const [currentSubmission, setCurrentSubmission] = useState<StudentSubmission | null>(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (checkSupabaseConfig()) {
      fetchInitialData();
    }
    const handleHash = () => {
      if (window.location.hash === '#hocsinh') setMode(AppMode.STUDENT_ENTRY);
      else setMode(AppMode.TEACHER_DASHBOARD);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    let interval: any;
    if (mode === AppMode.STUDENT_EXAM) {
      interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [mode]);

  const fetchInitialData = async () => {
    setIsDbLoading(true);
    try {
      const { data: exData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      if (exData) setExams(exData);
      const { data: subData } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
      if (subData) setSubmissions(subData);
    } catch (e) {
      console.error("Database connection error:", e);
    } finally {
      setIsDbLoading(false);
    }
  };

  const classStats = useMemo(() => {
    if (!currentExam) return [];
    const examSubmissions = submissions.filter(s => s.exam_id === currentExam.id);
    const statsMap: Record<string, any> = {};

    examSubmissions.forEach((s) => {
      const cls = s.class_name || "Chưa xác định";
      if (!statsMap[cls]) {
        statsMap[cls] = { className: cls, count: 0, totalScore: 0, maxScore: 0, students: [] };
      }
      statsMap[cls].count++;
      statsMap[cls].totalScore += s.score;
      statsMap[cls].maxScore = Math.max(statsMap[cls].maxScore, s.score);
      statsMap[cls].students.push(s);
    });
    return Object.values(statsMap);
  }, [submissions, currentExam]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setLoadingStep('Đang đọc file Word...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      setLoadingStep('AI đang xử lý câu hỏi...');
      const extracted = await extractQuestionsFromText(result.value);
      const newExam: Exam = {
        id: Math.random().toString(36).substring(2, 11),
        exam_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        title: extracted.title,
        description: `Tạo từ: ${file.name}`,
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

  const saveExamToCloud = async () => {
    if (!currentExam) return;
    setIsDbLoading(true);
    const { error } = await supabase.from('exams').insert([currentExam]);
    if (!error) {
      await fetchInitialData();
      setMode(AppMode.TEACHER_DASHBOARD);
    } else {
      alert("Lỗi lưu đề: " + error.message);
    }
    setIsDbLoading(false);
  };

  const toggleExamStatus = async (exam: Exam) => {
    const { error } = await supabase.from('exams').update({ is_open: !exam.is_open }).eq('id', exam.id);
    if (!error) fetchInitialData();
  };

  const deleteExam = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa đề thi này?")) return;
    await supabase.from('exams').delete().eq('id', id);
    fetchInitialData();
  };

  const joinExam = async () => {
    if (!studentName || !className || !examCodeInput) return alert("Vui lòng nhập đầy đủ thông tin!");
    setIsDbLoading(true);
    const { data, error } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
    if (error || !data) {
      alert("Mã đề thi không đúng hoặc không tồn tại!");
    } else if (!data.is_open) {
      alert("Hiện tại đề thi này đang đóng!");
    } else {
      setCurrentExam(data);
      setStudentAnswers({});
      setTimer(0);
      setMode(AppMode.STUDENT_EXAM);
    }
    setIsDbLoading(false);
  };

  const submitExam = async () => {
    if (!currentExam) return;
    let score = 0;
    currentExam.questions.forEach(q => {
      if (studentAnswers[q.id] === q.correctAnswerIndex) score++;
    });
    const payload = {
      exam_id: currentExam.id,
      student_name: studentName,
      class_name: className,
      answers: studentAnswers,
      score,
      total: currentExam.questions.length,
      time_spent: timer,
      submitted_at: new Date().toISOString()
    };
    setIsDbLoading(true);
    const { data, error } = await supabase.from('submissions').insert([payload]).select().single();
    if (!error) {
      setCurrentSubmission(data);
      setMode(AppMode.STUDENT_RESULT);
    } else {
      alert("Lỗi nộp bài: " + error.message);
    }
    setIsDbLoading(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // --- RENDERING ---

  const renderTeacherDashboard = () => (
    <div className="max-w-7xl mx-auto p-6 space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 flex items-center gap-3">
            <LayoutDashboard className="text-indigo-600" size={36}/> Quản lý Đề thi
          </h1>
          <p className="text-slate-500 font-medium">Hệ thống tạo đề AI và lưu trữ dữ liệu tập trung.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { window.location.hash = 'hocsinh'; }} className="bg-white border-2 border-slate-100 px-6 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2">
            <UserCircle size={24}/> Chế độ Học sinh
          </button>
          <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-100 transition-all active:scale-95">
            <Plus size={24}/> <span>Tạo Đề Mới (.docx)</span>
            <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map(exam => (
          <div key={exam.id} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-full h-1.5 ${exam.is_open ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
            <div className="flex justify-between items-start mb-4">
              <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-black tracking-widest uppercase">MÃ: {exam.exam_code}</span>
              <button onClick={() => toggleExamStatus(exam)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${exam.is_open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                {exam.is_open ? <Unlock size={12}/> : <Lock size={12}/>} {exam.is_open ? 'MỞ' : 'ĐÓNG'}
              </button>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-6 line-clamp-2">{exam.title}</h3>
            <div className="flex items-center gap-6 mb-8 text-slate-400">
              <div className="flex flex-col">
                <span className="text-2xl font-black text-slate-900">{submissions.filter(s => s.exam_id === exam.id).length}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">Lượt thi</span>
              </div>
              <div className="w-px h-8 bg-slate-100"></div>
              <div className="flex flex-col">
                <span className="text-2xl font-black text-slate-900">{exam.questions.length}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">Câu hỏi</span>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all">
                <BarChart3 size={18}/> Thống kê điểm
              </button>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#hocsinh`); alert("Đã copy link học sinh!"); }} className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-slate-100 hover:bg-slate-100">
                  <Share2 size={16}/> Link thi
                </button>
                <button onClick={() => deleteExam(exam.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all border border-red-100">
                  <Trash2 size={18}/>
                </button>
              </div>
            </div>
          </div>
        ))}
        {exams.length === 0 && !isDbLoading && (
          <div className="col-span-full py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
            <ClipboardList size={64} className="mb-4 opacity-20"/>
            <p className="text-lg font-bold">Chưa có đề thi nào. Hãy tải lên file Word để bắt đầu!</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStudentEntry = () => (
    <div className="max-w-md mx-auto py-20 px-6 animate-fade-in">
      <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-50">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-100">
          <GraduationCap size={40} className="text-white"/>
        </div>
        <h2 className="text-3xl font-black text-slate-900 text-center mb-10 tracking-tight">Hệ thống Thi Online</h2>
        <div className="space-y-6 mb-10">
          <div>
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block ml-2">Họ và tên</label>
            <input type="text" placeholder="Nguyễn Văn A" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all outline-none font-bold text-lg" value={studentName} onChange={e => setStudentName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block ml-2">Lớp</label>
            <input type="text" placeholder="12A1" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all outline-none font-bold text-lg" value={className} onChange={e => setClassName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block ml-2">Mã đề thi</label>
            <input type="text" placeholder="X8K2P" className="w-full p-5 rounded-2xl bg-indigo-50 border-2 border-indigo-200 focus:border-indigo-600 focus:bg-white transition-all outline-none font-black text-indigo-600 text-center uppercase tracking-[0.4em] text-2xl" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
          </div>
        </div>
        <button onClick={joinExam} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-[24px] font-black text-xl flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95">
          VÀO THI NGAY <ChevronRight size={24}/>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFF] font-sans">
      <nav className="bg-white border-b border-slate-100 py-5 px-8 sticky top-0 z-[100] backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { window.location.hash = ''; }}>
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-100"><GraduationCap className="text-white" size={24}/></div>
            <span className="text-xl font-black text-slate-900 tracking-tighter">SmartEnglish <span className="text-indigo-600 uppercase">AI</span></span>
          </div>
          <div className="flex items-center gap-4">
            {isDbLoading && <Loader2 className="animate-spin text-indigo-600" size={20}/>}
            <div className="hidden sm:block text-right">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Dữ liệu trực tuyến</div>
              <div className="text-xs font-bold text-slate-900">Cloud Database Connect</div>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8">
        {isProcessing && (
          <div className="max-w-xl mx-auto p-12 bg-white rounded-[40px] text-center shadow-xl mb-12 border border-slate-50 animate-pulse">
            <Loader2 className="animate-spin w-16 h-16 text-indigo-600 mx-auto mb-6"/>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{loadingStep}</h2>
            <p className="text-slate-400 font-medium italic">Trí tuệ nhân tạo đang làm việc...</p>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && renderTeacherDashboard()}
        {mode === AppMode.STUDENT_ENTRY && renderStudentEntry()}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto p-6 space-y-8 animate-fade-in">
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-1">Kiểm tra nội dung AI bóc tách</h2>
                <p className="text-slate-400 font-medium">Vui lòng rà soát lại trước khi xuất bản lên Cloud.</p>
              </div>
              <button onClick={saveExamToCloud} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
                <Database size={20}/> Lưu & Xuất Bản
              </button>
            </div>
            <div className="space-y-6">
              {currentExam.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-10 rounded-[32px] border border-slate-100 shadow-sm">
                  <div className="flex gap-4 mb-6">
                    <span className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black flex-shrink-0 text-sm">{idx+1}</span>
                    <p className="text-lg font-bold text-slate-800 leading-relaxed pt-1">{q.prompt}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-0 md:ml-14">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className={`p-4 rounded-xl border-2 flex items-center gap-4 ${oIdx === q.correctAnswerIndex ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'bg-slate-50 border-transparent text-slate-600'}`}>
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${oIdx === q.correctAnswerIndex ? 'bg-emerald-500 text-white' : 'bg-white shadow-sm'}`}>{String.fromCharCode(65+oIdx)}</span>
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto p-6 space-y-10 animate-fade-in">
            <div className="bg-white p-8 rounded-[32px] shadow-xl sticky top-24 z-50 flex justify-between items-center border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">{currentExam.questions.length}</div>
                <div>
                  <h2 className="font-black text-slate-900 text-lg leading-tight">{currentExam.title}</h2>
                  <p className="text-indigo-600 font-bold text-xs uppercase tracking-widest">{studentName} - {className}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-indigo-50 px-6 py-3.5 rounded-2xl border border-indigo-100">
                <Clock size={24} className="text-indigo-600"/>
                <span className="text-3xl font-black text-indigo-600 tabular-nums">{formatTime(timer)}</span>
              </div>
            </div>
            <div className="space-y-8">
              {currentExam.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-8 flex gap-4">
                    <span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black flex-shrink-0 shadow-lg">{idx+1}</span>
                    <span className="pt-1">{q.prompt}</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((opt, oIdx) => (
                      <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`p-5 rounded-2xl border-2 text-left font-bold transition-all flex items-center gap-4 ${studentAnswers[q.id] === oIdx ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'}`}>
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-slate-100'}`}>{String.fromCharCode(65+oIdx)}</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { if(confirm("Em chắc chắn muốn nộp bài?")) submitExam(); }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-8 rounded-[32px] font-black text-2xl shadow-xl transition-all active:scale-95 mb-20">NỘP BÀI THI</button>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
          <div className="max-w-md mx-auto py-20 px-6 animate-fade-in text-center">
            <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-slate-50">
              <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8"><Trophy size={48}/></div>
              <h2 className="text-4xl font-black text-slate-900 mb-2">Hoàn Thành!</h2>
              <p className="text-slate-400 font-bold mb-10">{studentName} • Lớp {className}</p>
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-indigo-50 p-6 rounded-3xl">
                  <div className="text-4xl font-black text-indigo-600">{currentSubmission.score}<span className="text-lg text-indigo-300">/{currentSubmission.total}</span></div>
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Câu đúng</div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl">
                  <div className="text-3xl font-black text-slate-600">{formatTime(currentSubmission.time_spent)}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Thời gian</div>
                </div>
              </div>
              <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold hover:bg-black transition-all">Quay lại trang chính</button>
            </div>
          </div>
        )}

        {mode === AppMode.VIEW_SUBMISSIONS && currentExam && (
          <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in">
            <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold mb-4 transition-all"><ArrowLeft size={20}/> Quay lại</button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-6">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Users size={28}/></div>
                <div>
                  <div className="text-3xl font-black text-slate-900">{submissions.filter(s => s.exam_id === currentExam.id).length}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Học sinh đã thi</div>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-6">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><PieChart size={28}/></div>
                <div>
                  <div className="text-3xl font-black text-slate-900">{classStats.length}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Số lớp tham gia</div>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-6">
                <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center"><Trophy size={28}/></div>
                <div>
                  <div className="text-3xl font-black text-slate-900">{classStats.length > 0 ? Math.max(...classStats.map(s => s.maxScore)) : 0}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Điểm cao nhất</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                <h3 className="text-2xl font-black text-slate-900">Bảng điểm chi tiết</h3>
                <div className="bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold text-slate-400">{currentExam.title}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5">Tên Học Sinh</th>
                      <th className="px-8 py-5">Lớp</th>
                      <th className="px-8 py-5">Số câu đúng</th>
                      <th className="px-8 py-5">Thời gian</th>
                      <th className="px-8 py-5 text-right">Nộp lúc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5 font-bold text-slate-900">{s.student_name}</td>
                        <td className="px-8 py-5"><span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold">{s.class_name}</span></td>
                        <td className="px-8 py-5 font-black text-indigo-600 text-lg">{s.score}<span className="text-xs text-slate-300">/{s.total}</span></td>
                        <td className="px-8 py-5 text-slate-400 font-medium">{formatTime(s.time_spent)}</td>
                        <td className="px-8 py-5 text-right text-slate-400 text-xs font-medium">{new Date(s.submitted_at).toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                    {submissions.filter(s => s.exam_id === currentExam.id).length === 0 && (
                      <tr><td colSpan={5} className="text-center py-20 text-slate-400 font-bold italic">Chưa có học sinh nào nộp bài.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
