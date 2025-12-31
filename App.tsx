
import React, { useState, useEffect } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, ChevronRight, Trash2, 
  Trophy, Clock, Users, ArrowLeft, Database,
  Lock, Unlock, UserCircle, BarChart3, PieChart,
  FileText, AlertCircle, RefreshCw, CheckCircle2, 
  CloudLightning, MousePointer2, Settings, ServerCrash,
  ClipboardList
} from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TEACHER_DASHBOARD);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [examCodeInput, setExamCodeInput] = useState('');
  const [studentAnswers, setStudentAnswers] = useState<Record<string, number>>({});
  const [currentSubmission, setCurrentSubmission] = useState<StudentSubmission | null>(null);
  const [timer, setTimer] = useState(0);

  // Cách lấy biến môi trường an toàn trong React component
  const getSafeEnv = (key: string) => {
    try { return (process.env as any)[key] || ''; } catch { return ''; }
  };

  const hasApiKey = !!getSafeEnv('API_KEY');
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (isConfigured) {
      fetchInitialData();
    }
    
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#hocsinh') setMode(AppMode.STUDENT_ENTRY);
      else if (!hash) setMode(AppMode.TEACHER_DASHBOARD);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [isConfigured]);

  useEffect(() => {
    let interval: any;
    if (mode === AppMode.STUDENT_EXAM) {
      interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [mode]);

  const fetchInitialData = async () => {
    if (!isConfigured) return;
    setIsDbLoading(true);
    setDbError(null);
    try {
      const { data: exData, error: exErr } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      if (exErr) throw exErr;
      setExams(exData || []);
      
      const { data: subData, error: subErr } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
      if (subErr) throw subErr;
      setSubmissions(subData || []);
    } catch (e: any) {
      console.error("Database Error:", e);
      setDbError(e.message || "Không thể kết nối tới Database. Kiểm tra bảng 'exams' đã được tạo chưa?");
    } finally {
      setIsDbLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setLoadingStep('Bắt đầu đọc tài liệu Word...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      
      if (!result.value || result.value.trim().length < 20) {
        throw new Error("Văn bản trong file quá ngắn hoặc không đọc được nội dung.");
      }

      setLoadingStep('AI đang bóc tách đề thi (Flash Engine)...');
      const extracted = await extractQuestionsFromText(result.value);
      
      const newExam: Exam = {
        id: Math.random().toString(36).substring(2, 11),
        exam_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        title: extracted.title,
        description: `Tạo từ: ${file.name}`,
        questions: extracted.questions,
        is_open: true,
        created_at: new Date().toISOString()
      };
      setCurrentExam(newExam);
      setMode(AppMode.EXAM_SETUP);
    } catch (error: any) {
      alert(error.message || "Đã xảy ra lỗi khi xử lý AI.");
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const saveExamToCloud = async () => {
    if (!currentExam) return;
    if (!isConfigured) return alert("Chưa cấu hình Supabase!");

    setIsDbLoading(true);
    try {
      const { error } = await supabase.from('exams').insert([currentExam]);
      if (error) throw error;
      
      await fetchInitialData();
      alert("Đề thi đã được lưu thành công trên Cloud!");
      setMode(AppMode.TEACHER_DASHBOARD);
    } catch (error: any) {
      alert("Lỗi lưu Cloud: " + error.message);
    } finally {
      setIsDbLoading(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Màn hình lỗi cấu hình / Kết nối
  if (!isConfigured || dbError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-xl w-full bg-white p-12 rounded-[48px] shadow-2xl border border-red-100 animate-fade-in">
          <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8">
            <ServerCrash size={48}/>
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-4">Lỗi kết nối Hệ thống</h2>
          <div className="bg-red-50 p-6 rounded-3xl text-red-600 font-bold mb-8 text-sm">
            {dbError ? `Database báo lỗi: ${dbError}` : "Bạn chưa cấu hình SUPABASE_URL hoặc SUPABASE_ANON_KEY trên Vercel."}
          </div>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3">
            <RefreshCw size={20}/> Thử kết nối lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] font-sans text-slate-900">
      <header className="bg-white/80 border-b border-slate-100 py-4 px-6 sticky top-0 z-[100] backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.hash = ''}>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <GraduationCap size={24}/>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block leading-none">Smart<span className="text-indigo-600">English</span></span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5 block">Cloud Connected</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[11px] font-black">
              <Database size={14}/> ONLINE DATABASE
            </div>
            <button onClick={fetchInitialData} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-indigo-600">
              <RefreshCw size={20} className={isDbLoading ? 'animate-spin' : ''}/>
            </button>
          </div>
        </div>
      </header>

      <main className="py-8 px-6 max-w-7xl mx-auto">
        {isProcessing && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
            <div className="bg-white p-12 rounded-[48px] text-center shadow-2xl max-w-lg w-full animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-slate-100">
                <div className="h-full bg-indigo-600 animate-[loading_2s_infinite]"></div>
              </div>
              <div className="bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                <CloudLightning size={48} className="text-indigo-600 animate-pulse"/>
              </div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">{loadingStep}</h2>
              <p className="text-slate-400 font-medium">Đang xử lý Cloud. Vui lòng không đóng trình duyệt.</p>
            </div>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && (
          <div className="space-y-10 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-gradient-to-br from-indigo-600 to-violet-700 p-10 rounded-[48px] text-white shadow-2xl shadow-indigo-200 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
                <div className="relative z-10">
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Quản lý Đề thi Cloud 👋</h1>
                  <p className="text-indigo-100 text-lg font-medium max-w-md">Mọi thứ được đồng bộ thời gian thực trên tất cả thiết bị.</p>
                </div>
                <div className="mt-10 flex gap-4 relative z-10">
                  <label className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-3">
                    <Plus size={24}/> Tạo đề từ Word
                    <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
              
              <div className="lg:col-span-4 grid grid-cols-1 gap-6">
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Users size={32}/></div>
                  <div className="text-4xl font-black text-slate-800">{submissions.length}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Lượt thi Online</div>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><FileText size={32}/></div>
                  <div className="text-4xl font-black text-slate-800">{exams.length}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Đề thi đã lưu</div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><ClipboardList className="text-indigo-600"/> Danh sách đề thi</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                      <span className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">MÃ: {exam.exam_code}</span>
                      <button onClick={async () => {
                        await supabase.from('exams').update({ is_open: !exam.is_open }).eq('id', exam.id);
                        fetchInitialData();
                      }} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${exam.is_open ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                        {exam.is_open ? <Unlock size={12}/> : <Lock size={12}/>} {exam.is_open ? 'MỞ' : 'ĐÓNG'}
                      </button>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-6 line-clamp-2 h-14 group-hover:text-indigo-600 transition-colors">{exam.title}</h3>
                    <div className="flex items-center gap-6 mb-8 bg-slate-50/50 p-4 rounded-3xl">
                      <div>
                        <div className="text-2xl font-black text-slate-800">{submissions.filter(s => s.exam_id === exam.id).length}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lượt thi</div>
                      </div>
                      <div className="w-px h-10 bg-slate-200"></div>
                      <div>
                        <div className="text-2xl font-black text-slate-800">{exam.questions.length}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Câu hỏi</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all">
                        <BarChart3 size={20}/> Xem Điểm
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => { 
                          const link = `${window.location.origin}${window.location.pathname}#hocsinh`;
                          navigator.clipboard.writeText(link); 
                          alert("Đã copy link học sinh!"); 
                        }} className="flex-1 bg-white text-indigo-600 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-indigo-100 hover:bg-indigo-50 transition-all">
                          <Share2 size={16}/> Link thi
                        </button>
                        <button onClick={async () => { 
                          if(confirm("Xác nhận xóa đề thi?")) { 
                            await supabase.from('exams').delete().eq('id', exam.id);
                            fetchInitialData(); 
                          } 
                        }} className="p-3.5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 border border-red-50 transition-colors">
                          <Trash2 size={20}/>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Các màn hình khác: STUDENT_ENTRY, STUDENT_EXAM... giữ nguyên logic giao diện đã có */}
        {mode === AppMode.STUDENT_ENTRY && (
          <div className="max-w-md mx-auto py-12 animate-fade-in">
            <div className="bg-white p-12 rounded-[56px] shadow-2xl border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-3 bg-indigo-600"></div>
              <h2 className="text-3xl font-black text-center mb-10 tracking-tight text-slate-800">Phòng thi Online</h2>
              <div className="space-y-5 mb-10">
                <input type="text" placeholder="Họ và tên" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none font-bold" value={studentName} onChange={e => setStudentName(e.target.value)} />
                <input type="text" placeholder="Lớp" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none font-bold" value={className} onChange={e => setClassName(e.target.value)} />
                <input type="text" placeholder="NHẬP MÃ PHÒNG" className="w-full p-6 rounded-3xl bg-indigo-50 border-2 border-indigo-200 focus:border-indigo-600 focus:bg-white outline-none font-black text-indigo-600 text-center uppercase tracking-widest text-3xl" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
              </div>
              <button onClick={async () => {
                if (!studentName || !className || !examCodeInput) return alert("Vui lòng điền đủ thông tin!");
                setIsDbLoading(true);
                const { data, error } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
                if (data && data.is_open) {
                  setCurrentExam(data); setStudentAnswers({}); setTimer(0); setMode(AppMode.STUDENT_EXAM);
                } else {
                  alert("Không tìm thấy đề thi hoặc phòng thi đã đóng!");
                }
                setIsDbLoading(false);
              }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-[32px] font-black text-xl shadow-xl transition-all">
                VÀO THI NGAY
              </button>
            </div>
          </div>
        )}

        {/* Tiếp tục với các mode khác tương tự phiên bản trước... */}
        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-24">
            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-[32px] shadow-xl sticky top-24 z-50 flex justify-between items-center border border-slate-100 border-b-4 border-b-indigo-600">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl">{currentExam.questions.length}</div>
                <div><h2 className="font-black text-slate-800 line-clamp-1">{currentExam.title}</h2><p className="text-xs font-bold text-indigo-600">{studentName} - {className}</p></div>
              </div>
              <div className="bg-indigo-50 px-6 py-3 rounded-2xl border border-indigo-100 flex items-center gap-3 text-indigo-600">
                <Clock size={24}/> <span className="text-3xl font-black tabular-nums">{formatTime(timer)}</span>
              </div>
            </div>
            {currentExam.questions.map((q, idx) => (
              <div key={q.id} className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100">
                <div className="flex gap-6 mb-8">
                  <span className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black flex-shrink-0">{idx+1}</span>
                  <p className="text-xl font-bold text-slate-800 leading-relaxed pt-1.5">{q.prompt}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {q.options.map((opt, oIdx) => (
                    <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`p-6 rounded-3xl border-2 text-left font-bold transition-all flex items-center gap-5 ${studentAnswers[q.id] === oIdx ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-transparent text-slate-600'}`}>
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-white text-indigo-600 shadow-sm'}`}>{String.fromCharCode(65+oIdx)}</span>
                      <span className="flex-1 text-lg">{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={async () => {
              if(!confirm("Bạn chắc chắn muốn nộp bài?")) return;
              let score = 0;
              currentExam.questions.forEach(q => { if(studentAnswers[q.id] === q.correctAnswerIndex) score++; });
              const payload = { 
                id: Math.random().toString(36).substring(2, 11),
                exam_id: currentExam.id, student_name: studentName, class_name: className, 
                answers: studentAnswers, score, total: currentExam.questions.length, 
                time_spent: timer, submitted_at: new Date().toISOString() 
              };
              setIsDbLoading(true);
              const { data, error } = await supabase.from('submissions').insert([payload]).select().single();
              if (!error && data) { setCurrentSubmission(data); setMode(AppMode.STUDENT_RESULT); }
              else alert("Lỗi khi nộp bài: " + error?.message);
              setIsDbLoading(false);
            }} className="w-full bg-emerald-500 text-white py-8 rounded-[40px] font-black text-3xl shadow-xl transition-all">NỘP BÀI THI</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
