
import React, { useState, useEffect, useRef } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, ChevronRight, Loader2, Trash2, 
  Trophy, Clock, Users, ArrowLeft, Database,
  Lock, Unlock, UserCircle, BarChart3, PieChart,
  FileText, AlertCircle, RefreshCw, CheckCircle2, 
  CloudLightning, MousePointer2, ExternalLink,
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
  
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [examCodeInput, setExamCodeInput] = useState('');
  const [studentAnswers, setStudentAnswers] = useState<Record<string, number>>({});
  const [currentSubmission, setCurrentSubmission] = useState<StudentSubmission | null>(null);
  const [timer, setTimer] = useState(0);

  const hasApiKey = !!process.env.API_KEY;

  useEffect(() => {
    if (isSupabaseConfigured()) {
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
      console.error("Database connection failed", e);
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
      
      setLoadingStep('AI đang phân tích cấu trúc đề thi...');
      const extracted = await extractQuestionsFromText(result.value);
      
      const newExam: Exam = {
        id: Math.random().toString(36).substring(2, 11),
        exam_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        title: extracted.title,
        description: `Tạo từ: ${file.name}`,
        questions: extracted.questions,
        is_open: true, // Mặc định mở luôn để học sinh có thể thi ngay
        created_at: new Date().toISOString()
      };
      setCurrentExam(newExam);
      setMode(AppMode.EXAM_SETUP);
    } catch (error: any) {
      alert(`Lỗi: ${error.message}`);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
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
      alert("Lỗi khi lưu đề thi: " + error.message);
    }
    setIsDbLoading(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#FDFDFF] font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white/80 border-b border-slate-100 py-4 px-6 sticky top-0 z-[100] backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.hash = ''}>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
              <GraduationCap size={24}/>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block leading-none">Smart<span className="text-indigo-600">English</span></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">AI Cloud Examination</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold ${hasApiKey ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
              <div className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
              {hasApiKey ? 'AI ENGINE READY' : 'AI CONFIG MISSING'}
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
              <p className="text-slate-400 font-medium">Chúng tôi đang sử dụng Gemini 3 Pro để xử lý đề thi của bạn với độ chính xác cao nhất.</p>
            </div>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && (
          <div className="space-y-10 animate-fade-in">
            {/* Bento Header */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-gradient-to-br from-indigo-600 to-violet-700 p-10 rounded-[48px] text-white shadow-2xl shadow-indigo-200 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
                <div className="relative z-10">
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Xin chào, Giáo viên! 👋</h1>
                  <p className="text-indigo-100 text-lg font-medium max-w-md">Bắt đầu ngày mới bằng việc tạo một đề thi tiếng Anh thông minh chỉ từ một cú nhấp chuột.</p>
                </div>
                <div className="mt-10 flex gap-4 relative z-10">
                  <label className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-900/20 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-3">
                    <Plus size={24}/> Tạo đề từ Word
                    <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                  </label>
                  <button onClick={() => window.location.hash = 'hocsinh'} className="bg-white/20 backdrop-blur-md text-white border border-white/30 px-8 py-4 rounded-2xl font-black text-lg hover:bg-white/30 transition-all flex items-center gap-3">
                    <UserCircle size={24}/> Chế độ Học sinh
                  </button>
                </div>
              </div>
              
              <div className="lg:col-span-4 grid grid-cols-1 gap-6">
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Users size={32}/></div>
                  <div className="text-4xl font-black text-slate-800">{submissions.length}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Tổng lượt thi online</div>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><FileText size={32}/></div>
                  <div className="text-4xl font-black text-slate-800">{exams.length}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Đề thi đã xuất bản</div>
                </div>
              </div>
            </div>

            {/* Exams Grid */}
            <div className="space-y-6">
              <div className="flex justify-between items-center px-2">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><ClipboardList className="text-indigo-600"/> Danh sách đề thi</h2>
                <div className="text-sm font-bold text-slate-400">{exams.length} đề thi hiện có</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                      <span className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">MÃ: {exam.exam_code}</span>
                      <button onClick={async () => {
                        const { error } = await supabase.from('exams').update({ is_open: !exam.is_open }).eq('id', exam.id);
                        if (!error) fetchInitialData();
                      }} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${exam.is_open ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                        {exam.is_open ? <Unlock size={12}/> : <Lock size={12}/>} {exam.is_open ? 'ĐANG MỞ' : 'ĐANG ĐÓNG'}
                      </button>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-6 line-clamp-2 h-14 leading-tight group-hover:text-indigo-600 transition-colors">{exam.title}</h3>
                    <div className="flex items-center gap-6 mb-8 bg-slate-50/50 p-4 rounded-3xl">
                      <div>
                        <div className="text-2xl font-black text-slate-800">{submissions.filter(s => s.exam_id === exam.id).length}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thí sinh</div>
                      </div>
                      <div className="w-px h-10 bg-slate-200"></div>
                      <div>
                        <div className="text-2xl font-black text-slate-800">{exam.questions.length}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Câu hỏi</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200">
                        <BarChart3 size={20}/> Kết quả & Thống kê
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#hocsinh`); alert("Đã copy link học sinh! Bạn hãy gửi cho các em qua Zalo/Facebook."); }} className="flex-1 bg-white text-indigo-600 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-indigo-100 hover:bg-indigo-50 transition-all">
                          <Share2 size={16}/> Link thi
                        </button>
                        <button onClick={async () => { if(confirm("Xác nhận xóa vĩnh viễn đề thi này?")) { await supabase.from('exams').delete().eq('id', exam.id); fetchInitialData(); } }} className="p-3.5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 border border-red-50 transition-colors">
                          <Trash2 size={20}/>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {exams.length === 0 && !isDbLoading && (
                  <div className="col-span-full py-24 bg-white rounded-[48px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-center px-6">
                    <div className="bg-slate-50 p-8 rounded-full mb-6"><FileText size={64} className="opacity-10"/></div>
                    <h3 className="text-2xl font-black text-slate-800">Chưa có đề thi nào</h3>
                    <p className="max-w-xs mt-2 font-medium">Hãy tải lên một tệp Word (.docx) để AI của chúng tôi tự động tạo đề thi cho bạn ngay bây giờ.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === AppMode.STUDENT_ENTRY && (
          <div className="max-w-md mx-auto py-12 animate-fade-in">
            <div className="bg-white p-12 rounded-[56px] shadow-2xl border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-3 bg-indigo-600"></div>
              <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-inner">
                <MousePointer2 size={48}/>
              </div>
              <h2 className="text-3xl font-black text-center mb-10 tracking-tight text-slate-800">Chào mừng Thí sinh!</h2>
              <div className="space-y-5 mb-10">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Họ và tên</label>
                  <input type="text" placeholder="Ví dụ: Nguyễn Văn A" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none font-bold transition-all" value={studentName} onChange={e => setStudentName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Lớp / Khối</label>
                  <input type="text" placeholder="Ví dụ: 12A3" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none font-bold transition-all" value={className} onChange={e => setClassName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-indigo-400 uppercase tracking-widest ml-1">Mã phòng thi</label>
                  <input type="text" placeholder="Nhập mã 6 ký tự" className="w-full p-6 rounded-3xl bg-indigo-50 border-2 border-indigo-200 focus:border-indigo-600 focus:bg-white outline-none font-black text-indigo-600 text-center uppercase tracking-[0.4em] text-3xl shadow-inner transition-all" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
                </div>
              </div>
              <button onClick={async () => {
                if (!studentName || !className || !examCodeInput) return alert("Vui lòng nhập đầy đủ thông tin để bắt đầu!");
                setIsDbLoading(true);
                const { data } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
                if (data && data.is_open) {
                  setCurrentExam(data); setStudentAnswers({}); setTimer(0); setMode(AppMode.STUDENT_EXAM);
                } else alert("Mã đề không tồn tại hoặc phòng thi đã đóng!");
                setIsDbLoading(false);
              }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-[32px] font-black text-xl flex items-center justify-center gap-4 shadow-2xl shadow-indigo-100 active:scale-95 transition-all">
                BẮT ĐẦU THI <ChevronRight size={28}/>
              </button>
            </div>
          </div>
        )}

        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-24">
            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-[32px] shadow-xl sticky top-24 z-50 flex justify-between items-center border border-slate-100 border-b-4 border-b-indigo-600">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl">{currentExam.questions.length}</div>
                <div>
                  <h2 className="font-black text-slate-800 leading-tight line-clamp-1">{currentExam.title}</h2>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mt-0.5">{studentName} • Lớp {className}</p>
                </div>
              </div>
              <div className="bg-indigo-50 px-6 py-3 rounded-2xl border border-indigo-100 flex items-center gap-3 text-indigo-600">
                <Clock size={24} className="animate-pulse"/> 
                <span className="text-3xl font-black tabular-nums">{formatTime(timer)}</span>
              </div>
            </div>
            
            <div className="space-y-8">
              {currentExam.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 hover:border-indigo-100 transition-all duration-300">
                  <div className="flex gap-6 mb-8">
                    <span className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black flex-shrink-0 text-lg shadow-inner">{idx+1}</span>
                    <p className="text-xl font-bold text-slate-800 leading-relaxed pt-1.5">{q.prompt}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {q.options.map((opt, oIdx) => (
                      <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`p-6 rounded-3xl border-2 text-left font-bold transition-all flex items-center gap-5 group ${studentAnswers[q.id] === oIdx ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl shadow-indigo-100 scale-[1.02]' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'}`}>
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-colors ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-white text-indigo-600 shadow-sm'}`}>{String.fromCharCode(65+oIdx)}</span>
                        <span className="flex-1 text-lg">{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-10">
                <button onClick={async () => {
                  if(!confirm("Bạn chắc chắn muốn nộp bài? Hãy kiểm tra lại các câu chưa làm nhé.")) return;
                  let score = 0;
                  currentExam.questions.forEach(q => { if(studentAnswers[q.id] === q.correctAnswerIndex) score++; });
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
                  setIsDbLoading(false);
                  if (!error) { setCurrentSubmission(data); setMode(AppMode.STUDENT_RESULT); }
                } } className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-8 rounded-[40px] font-black text-3xl shadow-2xl shadow-emerald-100 transition-all active:scale-95">NỘP BÀI THI</button>
              </div>
            </div>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
          <div className="max-w-md mx-auto py-12 animate-fade-in text-center">
            <div className="bg-white p-14 rounded-[64px] shadow-2xl border border-slate-50 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-3 bg-emerald-500"></div>
              <div className="w-28 h-28 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
                <Trophy size={56}/>
              </div>
              <h2 className="text-4xl font-black mb-2 text-slate-800 tracking-tight">Hoàn tất!</h2>
              <p className="text-slate-400 font-bold mb-10 text-lg">{studentName} • Lớp {className}</p>
              <div className="grid grid-cols-2 gap-6 mb-12">
                <div className="bg-indigo-50 p-8 rounded-[40px] border border-indigo-100">
                  <div className="text-5xl font-black text-indigo-600">{currentSubmission.score}<span className="text-lg text-indigo-300">/{currentSubmission.total}</span></div>
                  <div className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mt-2">Câu đúng</div>
                </div>
                <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                  <div className="text-3xl font-black text-slate-600">{formatTime(currentSubmission.time_spent)}</div>
                  <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-3">Thời gian</div>
                </div>
              </div>
              <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xl hover:bg-black transition-all">Về Trang Chủ</button>
            </div>
          </div>
        )}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-24">
            <div className="bg-white p-10 rounded-[48px] shadow-xl border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[32px] flex items-center justify-center shadow-inner"><CheckCircle2 size={40}/></div>
                <div>
                  <h2 className="text-3xl font-black text-slate-800">AI đã bóc tách xong!</h2>
                  <p className="text-slate-500 font-medium text-lg">Chúng tôi tìm thấy {currentExam.questions.length} câu hỏi. Hãy kiểm tra lại trước khi lưu.</p>
                </div>
              </div>
              <button onClick={saveExamToCloud} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-2xl shadow-indigo-100 transition-all active:scale-95">
                <Database size={24}/> Xuất bản Đề thi
              </button>
            </div>
            <div className="space-y-6">
              {currentExam.questions.map((q, idx) => (
                <div key={idx} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
                  <div className="flex gap-5 mb-8">
                    <span className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-sm">{idx+1}</span>
                    <p className="font-bold text-slate-800 pt-1.5 leading-relaxed text-lg">{q.prompt}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-14">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className={`p-5 rounded-2xl border-2 transition-all font-bold ${oIdx === q.correctAnswerIndex ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                        <span className="mr-3 opacity-50">{String.fromCharCode(65+oIdx)}.</span> {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === AppMode.VIEW_SUBMISSIONS && currentExam && (
          <div className="space-y-10 animate-fade-in pb-24">
            <div className="flex items-center gap-4">
              <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="p-4 bg-white border border-slate-100 rounded-[24px] text-slate-400 hover:text-indigo-600 hover:shadow-md transition-all">
                <ArrowLeft size={24}/>
              </button>
              <div>
                <h1 className="text-3xl font-black text-slate-800 leading-tight">Báo cáo kết quả: {currentExam.title}</h1>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1 flex items-center gap-2">
                  <Database size={14}/> Dữ liệu lưu trữ trên Supabase Cloud
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex items-center gap-8 group hover:border-indigo-200 transition-colors">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[28px] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform"><Users size={32}/></div>
                <div>
                  <div className="text-4xl font-black text-slate-800">{submissions.filter(s => s.exam_id === currentExam.id).length}</div>
                  <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">Học sinh tham gia</div>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex items-center gap-8 group hover:border-emerald-200 transition-colors">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-[28px] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform"><PieChart size={32}/></div>
                <div>
                  <div className="text-4xl font-black text-slate-800">
                    {submissions.filter(s => s.exam_id === currentExam.id).length > 0 
                      ? (submissions.filter(s => s.exam_id === currentExam.id).reduce((a,b)=>a+b.score,0) / submissions.filter(s => s.exam_id === currentExam.id).length).toFixed(1) 
                      : "0"}
                  </div>
                  <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">Điểm trung bình</div>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex items-center gap-8 group hover:border-amber-200 transition-colors">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-[28px] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform"><Trophy size={32}/></div>
                <div>
                  <div className="text-4xl font-black text-slate-800">
                    {submissions.filter(s => s.exam_id === currentExam.id).length > 0 
                      ? Math.max(...submissions.filter(s => s.exam_id === currentExam.id).map(s => s.score)) 
                      : "0"}
                  </div>
                  <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">Điểm cao nhất</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[56px] border border-slate-100 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[11px] font-black uppercase tracking-widest">
                      <th className="px-10 py-8">Tên thí sinh</th>
                      <th className="px-10 py-8">Lớp</th>
                      <th className="px-10 py-8 text-center">Câu đúng</th>
                      <th className="px-10 py-8 text-center">Thời gian</th>
                      <th className="px-10 py-8 text-right">Ngày nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-10 py-7 font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{s.student_name}</td>
                        <td className="px-10 py-7 font-bold text-slate-500">{s.class_name}</td>
                        <td className="px-10 py-7 text-center">
                          <span className="text-2xl font-black text-slate-800">{s.score}</span>
                          <span className="text-sm text-slate-300 font-bold ml-1">/ {s.total}</span>
                        </td>
                        <td className="px-10 py-7 text-center font-mono font-bold text-slate-400">{formatTime(s.time_spent)}</td>
                        <td className="px-10 py-7 text-right text-slate-400 text-xs font-bold">{new Date(s.submitted_at).toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                    {submissions.filter(s => s.exam_id === currentExam.id).length === 0 && (
                      <tr><td colSpan={5} className="text-center py-32 text-slate-400 font-bold italic opacity-30 text-xl">CHƯA CÓ DỮ LIỆU NỘP BÀI</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className="py-12 px-6 border-t border-slate-100 text-center">
        <div className="flex items-center justify-center gap-2 text-slate-300 font-bold uppercase tracking-widest text-[10px]">
          <Database size={12}/> Kết nối dữ liệu thời gian thực • <CloudLightning size={12}/> Xử lý bởi Gemini AI
        </div>
      </footer>
    </div>
  );
};

export default App;
