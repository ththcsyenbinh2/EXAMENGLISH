
import React, { useState, useEffect } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, ChevronRight, Loader2, Trash2, 
  Trophy, Clock, Users, ArrowLeft, Database,
  Lock, Unlock, UserCircle, BarChart3, PieChart,
  ClipboardList, LayoutDashboard, AlertTriangle, Key, Settings2
} from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TEACHER_DASHBOARD);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [hasKey, setHasKey] = useState<boolean>(!!process.env.API_KEY);
  
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [examCodeInput, setExamCodeInput] = useState('');
  const [studentAnswers, setStudentAnswers] = useState<Record<string, number>>({});
  const [currentSubmission, setCurrentSubmission] = useState<StudentSubmission | null>(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected || !!process.env.API_KEY);
      }
    };
    checkKey();
    
    if (isSupabaseConfigured()) {
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

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Giả định sau khi mở dialog, key sẽ có sẵn trong process.env.API_KEY
      setHasKey(true);
    } else {
      alert("Môi trường này không hỗ trợ trình chọn API Key. Vui lòng cấu hình qua Environment Variables.");
    }
  };

  const fetchInitialData = async () => {
    setIsDbLoading(true);
    try {
      const { data: exData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      if (exData) setExams(exData);
      const { data: subData } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
      if (subData) setSubmissions(subData);
    } catch (e) {
      console.error("Database error", e);
    } finally {
      setIsDbLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Kiểm tra key lần cuối trước khi gọi AI
    if (!process.env.API_KEY && !hasKey) {
      await handleSelectKey();
      // Nếu sau khi hiện dialog vẫn không có key thì dừng
      if (!process.env.API_KEY) return;
    }

    setIsProcessing(true);
    setLoadingStep('Đang đọc file Word...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      setLoadingStep('AI đang bóc tách câu hỏi...');
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

  const saveExam = async () => {
    if (!currentExam) return;
    if (!isSupabaseConfigured()) return alert("Cần cấu hình Supabase để lưu dữ liệu!");
    setIsDbLoading(true);
    const { error } = await supabase.from('exams').insert([currentExam]);
    if (!error) {
      await fetchInitialData();
      setMode(AppMode.TEACHER_DASHBOARD);
    } else alert("Lỗi lưu: " + error.message);
    setIsDbLoading(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#F9FBFF] font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 py-4 px-8 sticky top-0 z-[100] backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.hash = ''}>
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100"><GraduationCap className="text-white" size={24}/></div>
            <span className="text-xl font-black tracking-tight">SmartExam <span className="text-indigo-600">AI</span></span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSelectKey}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                hasKey ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'
              }`}
            >
              <Key size={14}/> {hasKey ? 'AI Sẵn sàng' : 'Cấu hình AI Key'}
            </button>
            {isDbLoading && <Loader2 className="animate-spin text-indigo-600" size={20}/>}
          </div>
        </div>
      </header>

      <main className="py-8 px-6">
        {isProcessing && (
          <div className="max-w-xl mx-auto p-12 bg-white rounded-3xl text-center shadow-xl border border-slate-100 animate-fade-in mb-8">
            <Loader2 className="animate-spin w-12 h-12 text-indigo-600 mx-auto mb-4"/>
            <h2 className="text-xl font-bold">{loadingStep}</h2>
            <p className="text-slate-500 text-sm mt-2 italic">Vui lòng đợi trong giây lát...</p>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && (
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-black flex items-center gap-3"><LayoutDashboard size={32} className="text-indigo-600"/> Quản lý Đề thi</h1>
                <p className="text-slate-500 font-medium">Bản nâng cấp: Tự động bóc tách từ Word & Chấm điểm Cloud.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => window.location.hash = 'hocsinh'} className="bg-white border border-slate-200 px-5 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                  <UserCircle size={20}/> Chế độ Học sinh
                </button>
                <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-100 transition-all active:scale-95">
                  <Plus size={20}/> <span>Tạo đề từ Word</span>
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>

            {!hasKey && (
              <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex gap-4 items-center">
                <div className="bg-amber-500 p-3 rounded-2xl text-white shadow-lg shadow-amber-100"><Settings2 size={24}/></div>
                <div className="flex-1">
                  <h4 className="font-bold text-amber-900">Chưa cấu hình API Key</h4>
                  <p className="text-amber-700 text-sm">Bạn cần cấu hình API Key của Gemini để sử dụng tính năng AI bóc tách đề thi.</p>
                </div>
                <button onClick={handleSelectKey} className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition-all">Thiết lập ngay</button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exams.map(exam => (
                <div key={exam.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                  <div className={`absolute top-0 left-0 w-full h-1.5 ${exam.is_open ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase">MÃ: {exam.exam_code}</span>
                    <button onClick={async () => {
                      const { error } = await supabase.from('exams').update({ is_open: !exam.is_open }).eq('id', exam.id);
                      if (!error) fetchInitialData();
                    }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${exam.is_open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {exam.is_open ? <Unlock size={12}/> : <Lock size={12}/>} {exam.is_open ? 'ĐANG MỞ' : 'ĐANG ĐÓNG'}
                    </button>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-6 line-clamp-2 h-14 leading-tight">{exam.title}</h3>
                  <div className="flex items-center gap-6 mb-6">
                    <div>
                      <div className="text-2xl font-black">{submissions.filter(s => s.exam_id === exam.id).length}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lượt thi</div>
                    </div>
                    <div className="w-px h-8 bg-slate-100"></div>
                    <div>
                      <div className="text-2xl font-black">{exam.questions.length}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Câu hỏi</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all">
                      <BarChart3 size={16}/> Xem bảng điểm
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#hocsinh`); alert("Đã copy link học sinh!"); }} className="flex-1 bg-slate-50 text-slate-600 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-100 hover:bg-slate-100">
                        <Share2 size={14}/> Link thi
                      </button>
                      <button onClick={async () => { if(confirm("Xóa đề này?")) { await supabase.from('exams').delete().eq('id', exam.id); fetchInitialData(); } }} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 border border-red-50 transition-colors">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {exams.length === 0 && !isDbLoading && (
                <div className="col-span-full py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                  <ClipboardList size={48} className="mb-4 opacity-20"/>
                  <p className="font-bold">Chưa có đề thi nào. Hãy tải lên file Word để AI hỗ trợ!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === AppMode.STUDENT_ENTRY && (
          <div className="max-w-md mx-auto py-12 animate-fade-in">
            <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100">
              <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-100">
                <GraduationCap size={40} className="text-white"/>
              </div>
              <h2 className="text-2xl font-black text-center mb-8 tracking-tight">Vào Phòng Thi Online</h2>
              <div className="space-y-4 mb-8">
                <input type="text" placeholder="Họ và tên của em" className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none font-bold transition-all" value={studentName} onChange={e => setStudentName(e.target.value)} />
                <input type="text" placeholder="Lớp (Ví dụ: 12A1)" className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none font-bold transition-all" value={className} onChange={e => setClassName(e.target.value)} />
                <input type="text" placeholder="MÃ ĐỀ THI" className="w-full p-5 rounded-2xl bg-indigo-50 border-2 border-indigo-200 focus:border-indigo-600 focus:bg-white outline-none font-black text-indigo-600 text-center uppercase tracking-[0.3em] text-2xl transition-all" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
              </div>
              <button onClick={async () => {
                if (!studentName || !className || !examCodeInput) return alert("Em cần nhập đủ thông tin nhé!");
                setIsDbLoading(true);
                const { data } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
                if (data && data.is_open) {
                  setCurrentExam(data); setStudentAnswers({}); setTimer(0); setMode(AppMode.STUDENT_EXAM);
                } else alert("Mã đề không đúng hoặc phòng thi đã đóng!");
                setIsDbLoading(false);
              }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-[28px] font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-indigo-100">
                BẮT ĐẦU LÀM BÀI <ChevronRight size={24}/>
              </button>
            </div>
          </div>
        )}

        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            <div className="bg-white p-6 rounded-3xl shadow-xl sticky top-20 z-50 flex justify-between items-center border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black">{currentExam.questions.length}</div>
                <div>
                  <h2 className="font-bold text-slate-900 leading-tight line-clamp-1">{currentExam.title}</h2>
                  <p className="text-xs font-bold text-indigo-600">{studentName} - {className}</p>
                </div>
              </div>
              <div className="bg-indigo-50 px-5 py-2.5 rounded-xl border border-indigo-100 flex items-center gap-2 text-indigo-600">
                <Clock size={20}/> <span className="text-2xl font-black tabular-nums">{formatTime(timer)}</span>
              </div>
            </div>
            <div className="space-y-6 pb-20">
              {currentExam.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 transition-all hover:shadow-md">
                  <div className="flex gap-4 mb-6">
                    <span className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black flex-shrink-0 text-sm">{idx+1}</span>
                    <p className="text-lg font-bold text-slate-800 leading-relaxed pt-1">{q.prompt}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((opt, oIdx) => (
                      <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`p-4 rounded-xl border-2 text-left font-bold transition-all flex items-center gap-3 ${studentAnswers[q.id] === oIdx ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-50 text-slate-600 hover:bg-slate-50'}`}>
                        <span className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-black ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-slate-100'}`}>{String.fromCharCode(65+oIdx)}</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={async () => {
                if(!confirm("Em đã kiểm tra kỹ và muốn nộp bài?")) return;
                let score = 0;
                currentExam.questions.forEach(q => { if(studentAnswers[q.id] === q.correctAnswerIndex) score++; });
                const payload = { exam_id: currentExam.id, student_name: studentName, class_name: className, answers: studentAnswers, score, total: currentExam.questions.length, time_spent: timer, submitted_at: new Date().toISOString() };
                const { data, error } = await supabase.from('submissions').insert([payload]).select().single();
                if (!error) { setCurrentSubmission(data); setMode(AppMode.STUDENT_RESULT); }
              }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-[28px] font-black text-2xl shadow-xl shadow-emerald-100 transition-all active:scale-95">NỘP BÀI VÀ XEM ĐIỂM</button>
            </div>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
          <div className="max-w-md mx-auto py-12 animate-fade-in text-center">
            <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-50 overflow-hidden relative">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"><Trophy size={40}/></div>
              <h2 className="text-3xl font-black mb-2 tracking-tight">Hoàn Thành!</h2>
              <p className="text-slate-400 font-bold mb-8">{studentName} • Lớp {className}</p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                  <div className="text-3xl font-black text-indigo-600">{currentSubmission.score}<span className="text-sm text-indigo-300">/{currentSubmission.total}</span></div>
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Câu đúng</div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div className="text-2xl font-black text-slate-600">{formatTime(currentSubmission.time_spent)}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Thời gian</div>
                </div>
              </div>
              <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold hover:bg-black transition-all">Quay lại trang chính</button>
            </div>
          </div>
        )}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20">
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black">AI đã bóc tách xong!</h2>
                <p className="text-slate-500 text-sm">Hệ thống đã nhận diện được {currentExam.questions.length} câu hỏi trắc nghiệm.</p>
              </div>
              <button onClick={saveExam} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all active:scale-95">
                <Database size={20}/> Xuất Bản Đề Thi
              </button>
            </div>
            <div className="space-y-4">
              {currentExam.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-[32px] border border-slate-200">
                  <p className="font-bold text-slate-800 mb-4 flex gap-3"><span className="text-indigo-600">Câu {idx+1}:</span> {q.prompt}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className={`p-4 rounded-xl border-2 ${oIdx === q.correctAnswerIndex ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'bg-slate-50 border-transparent text-slate-500'}`}>
                        {String.fromCharCode(65+oIdx)}. {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === AppMode.VIEW_SUBMISSIONS && currentExam && (
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
            <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold mb-4 transition-colors"><ArrowLeft size={18}/> Quay lại Quản lý</button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Users size={24}/></div>
                <div>
                  <div className="text-3xl font-black">{submissions.filter(s => s.exam_id === currentExam.id).length}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Học sinh đã thi</div>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><PieChart size={24}/></div>
                <div>
                  <div className="text-3xl font-black">
                    {submissions.filter(s => s.exam_id === currentExam.id).length > 0 
                      ? (submissions.filter(s => s.exam_id === currentExam.id).reduce((a,b)=>a+b.score,0) / submissions.filter(s => s.exam_id === currentExam.id).length).toFixed(1) 
                      : 0}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trung bình câu đúng</div>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center"><Trophy size={24}/></div>
                <div>
                  <div className="text-3xl font-black">
                    {submissions.filter(s => s.exam_id === currentExam.id).length > 0 
                      ? Math.max(...submissions.filter(s => s.exam_id === currentExam.id).map(s => s.score)) 
                      : 0}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Điểm cao nhất</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <h3 className="text-xl font-black">Bảng điểm chi tiết: {currentExam.title}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5">Tên Học Sinh</th>
                      <th className="px-8 py-5">Lớp</th>
                      <th className="px-8 py-5">Câu đúng</th>
                      <th className="px-8 py-5">Thời gian</th>
                      <th className="px-8 py-5 text-right">Ngày nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-8 py-5 font-bold text-slate-900 group-hover:text-indigo-600">{s.student_name}</td>
                        <td className="px-8 py-5 font-bold text-indigo-600">{s.class_name}</td>
                        <td className="px-8 py-5 font-black text-lg">{s.score}<span className="text-xs text-slate-300">/{s.total}</span></td>
                        <td className="px-8 py-5 text-slate-400 text-sm font-medium">{formatTime(s.time_spent)}</td>
                        <td className="px-8 py-5 text-right text-slate-400 text-xs">{new Date(s.submitted_at).toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                    {submissions.filter(s => s.exam_id === currentExam.id).length === 0 && (
                      <tr><td colSpan={5} className="text-center py-20 text-slate-400 font-bold italic opacity-50">Chưa có kết quả nộp bài nào.</td></tr>
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
