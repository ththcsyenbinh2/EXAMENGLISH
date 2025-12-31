
import React, { useState, useEffect, useMemo } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText } from './services/geminiService';
import { supabase, isConfigured } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, ChevronRight, Loader2, Trash2, 
  Trophy, Clock, Users, ArrowLeft, Database,
  Lock, Unlock, UserCircle, School, BarChart3, PieChart,
  ClipboardList, LayoutDashboard, CheckCircle2, AlertCircle
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
    if (isConfigured()) {
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
    if (!isConfigured()) return;
    setIsDbLoading(true);
    try {
      const { data: exData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      if (exData) setExams(exData);
      const { data: subData } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
      if (subData) setSubmissions(subData);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setIsDbLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setLoadingStep('Đang đọc nội dung Word...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      // mammoth được import từ index.html
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
      alert(`Lỗi xử lý: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveToCloud = async () => {
    if (!currentExam) return;
    if (!isConfigured()) return alert("Vui lòng cấu hình Supabase URL/Key trong Environment Variables!");
    
    setIsDbLoading(true);
    const { error } = await supabase.from('exams').insert([currentExam]);
    if (!error) {
      await fetchInitialData();
      setMode(AppMode.TEACHER_DASHBOARD);
    } else {
      alert("Lỗi lưu trữ: " + error.message);
    }
    setIsDbLoading(false);
  };

  const toggleStatus = async (exam: Exam) => {
    const { error } = await supabase.from('exams').update({ is_open: !exam.is_open }).eq('id', exam.id);
    if (!error) fetchInitialData();
  };

  const startExam = async () => {
    if (!studentName || !className || !examCodeInput) return alert("Vui lòng điền đủ thông tin!");
    setIsDbLoading(true);
    const { data, error } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
    if (error || !data) {
      alert("Mã đề thi không tồn tại!");
    } else if (!data.is_open) {
      alert("Đề thi này đang đóng!");
    } else {
      setCurrentExam(data);
      setStudentAnswers({});
      setTimer(0);
      setMode(AppMode.STUDENT_EXAM);
    }
    setIsDbLoading(false);
  };

  const submitTest = async () => {
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
    }
    setIsDbLoading(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // UI Parts
  const renderDashboard = () => (
    <div className="max-w-7xl mx-auto p-6 space-y-12 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutDashboard className="text-indigo-600" size={40}/> Dashboard Giáo Viên
          </h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý đề thi và theo dõi kết quả học sinh tập trung.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => window.location.hash = 'hocsinh'}
            className="bg-white border-2 border-slate-100 px-6 py-4 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <UserCircle size={22}/> Chế độ Học sinh
          </button>
          <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 cursor-pointer shadow-xl shadow-indigo-100 transition-all active:scale-95">
            <Plus size={24}/> <span>Tải lên Đề thi (.docx)</span>
            <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {!isConfigured() && (
        <div className="bg-orange-50 border-2 border-orange-200 p-6 rounded-3xl flex items-center gap-4 text-orange-700">
          <AlertCircle size={24}/>
          <p className="font-bold">Cảnh báo: Supabase chưa được cấu hình. Bạn chỉ có thể xem demo, không thể lưu dữ liệu.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {exams.map(exam => (
          <div key={exam.id} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-2 ${exam.is_open ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
            <div className="flex justify-between items-start mb-6">
              <span className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-xl text-xs font-black tracking-widest uppercase">MÃ: {exam.exam_code}</span>
              <button 
                onClick={() => toggleStatus(exam)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black tracking-widest transition-all ${
                  exam.is_open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {exam.is_open ? <Unlock size={14}/> : <Lock size={14}/>} {exam.is_open ? 'ĐANG MỞ' : 'ĐANG ĐÓNG'}
              </button>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-6 line-clamp-2 min-h-[4rem]">{exam.title}</h3>
            <div className="flex items-center gap-8 mb-8">
              <div className="flex flex-col">
                <span className="text-3xl font-black text-slate-900">{submissions.filter(s => s.exam_id === exam.id).length}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lượt thi</span>
              </div>
              <div className="w-px h-10 bg-slate-100"></div>
              <div className="flex flex-col">
                <span className="text-3xl font-black text-slate-900">{exam.questions.length}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Câu hỏi</span>
              </div>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-black transition-all"
              >
                <BarChart3 size={18}/> Bảng điểm & Thống kê
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}#hocsinh`;
                    navigator.clipboard.writeText(url);
                    alert("Đã copy link học sinh!");
                  }}
                  className="flex-1 bg-slate-50 text-slate-600 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-slate-100 hover:bg-slate-100 transition-all"
                >
                  <Share2 size={16}/> Copy Link
                </button>
                <button 
                  onClick={async () => {
                    if (confirm("Xóa đề này?")) {
                      await supabase.from('exams').delete().eq('id', exam.id);
                      fetchInitialData();
                    }
                  }}
                  className="p-3.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all border border-red-50"
                >
                  <Trash2 size={18}/>
                </button>
              </div>
            </div>
          </div>
        ))}
        {exams.length === 0 && !isDbLoading && (
          <div className="col-span-full py-24 bg-white rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-center">
            <ClipboardList size={80} className="mb-6 opacity-10"/>
            <p className="text-xl font-bold">Chưa có đề thi nào.</p>
            <p className="text-sm font-medium max-w-xs mt-2">Hãy tải lên một file Word (.docx) chứa các câu hỏi trắc nghiệm để AI bắt đầu xử lý.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFF]">
      <header className="bg-white border-b border-slate-100 py-6 px-10 sticky top-0 z-[100] backdrop-blur-xl bg-white/90">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => window.location.hash = ''}>
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100">
              <GraduationCap className="text-white" size={28}/>
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tighter">SmartEnglish <span className="text-indigo-600">AI</span></span>
          </div>
          <div className="flex items-center gap-4">
            {isDbLoading && <Loader2 className="animate-spin text-indigo-600" size={24}/>}
            <div className="hidden sm:block text-right">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Dữ liệu đám mây</div>
              <div className="text-sm font-bold text-slate-900">Cloud Sync Active</div>
            </div>
          </div>
        </div>
      </header>

      <main className="py-10">
        {isProcessing && (
          <div className="max-w-xl mx-auto p-16 bg-white rounded-[48px] text-center shadow-2xl mb-12 border border-slate-50 animate-pulse">
            <Loader2 className="animate-spin w-20 h-20 text-indigo-600 mx-auto mb-8"/>
            <h2 className="text-3xl font-black text-slate-900 mb-2">{loadingStep}</h2>
            <p className="text-slate-400 font-medium">Trí tuệ nhân tạo đang phân tích đề thi của bạn...</p>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && renderDashboard()}

        {mode === AppMode.STUDENT_ENTRY && (
          <div className="max-w-md mx-auto py-20 px-6 animate-fade-in">
            <div className="bg-white p-12 rounded-[56px] shadow-2xl border border-slate-50">
              <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-xl shadow-indigo-200">
                <GraduationCap size={44} className="text-white"/>
              </div>
              <h2 className="text-4xl font-black text-slate-900 text-center mb-12 tracking-tight">Học Sinh Thi</h2>
              <div className="space-y-6 mb-12">
                <input 
                  type="text" placeholder="Họ và tên của em" 
                  className="w-full p-6 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all outline-none font-bold text-lg" 
                  value={studentName} onChange={e => setStudentName(e.target.value)} 
                />
                <input 
                  type="text" placeholder="Lớp (Ví dụ: 12A1)" 
                  className="w-full p-6 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all outline-none font-bold text-lg" 
                  value={className} onChange={e => setClassName(e.target.value)} 
                />
                <input 
                  type="text" placeholder="MÃ ĐỀ THI" 
                  className="w-full p-6 rounded-3xl bg-indigo-50 border-2 border-indigo-200 focus:border-indigo-600 focus:bg-white transition-all outline-none font-black text-indigo-600 text-center uppercase tracking-[0.5em] text-2xl" 
                  value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} 
                />
              </div>
              <button onClick={startExam} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-8 rounded-[32px] font-black text-2xl shadow-2xl shadow-indigo-100 transition-all flex items-center justify-center gap-4 active:scale-95">
                BẮT ĐẦU LÀM BÀI <ChevronRight size={32}/>
              </button>
            </div>
          </div>
        )}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-5xl mx-auto p-6 animate-fade-in space-y-10">
            <div className="bg-white p-10 rounded-[40px] shadow-sm flex justify-between items-center border border-slate-100">
              <div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">Kiểm tra kết quả bóc tách</h2>
                <p className="text-slate-500 font-medium">AI đã nhận diện thành công {currentExam.questions.length} câu hỏi trắc nghiệm.</p>
              </div>
              <button onClick={saveToCloud} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-3xl font-black text-xl shadow-xl shadow-indigo-100 transition-all flex items-center gap-3 active:scale-95">
                <Database size={24}/> Xuất Bản Đề Thi
              </button>
            </div>
            <div className="space-y-8 pb-20">
              {currentExam.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex gap-6 mb-8">
                    <span className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black flex-shrink-0 text-xl shadow-sm">{idx+1}</span>
                    <p className="text-xl font-bold text-slate-800 leading-relaxed pt-3">{q.prompt}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-0 md:ml-20">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className={`p-6 rounded-3xl border-2 flex items-center gap-4 transition-all ${oIdx === q.correctAnswerIndex ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'bg-slate-50 border-transparent text-slate-500'}`}>
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${oIdx === q.correctAnswerIndex ? 'bg-emerald-500 text-white' : 'bg-white shadow-sm'}`}>{String.fromCharCode(65+oIdx)}</span>
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
          <div className="max-w-4xl mx-auto p-6 animate-fade-in space-y-10">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 sticky top-28 z-50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">{currentExam.questions.length}</div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 leading-tight line-clamp-1">{currentExam.title}</h2>
                  <p className="text-indigo-600 font-black text-xs uppercase tracking-widest mt-1">{studentName} • Lớp {className}</p>
                </div>
              </div>
              <div className="bg-indigo-50 px-8 py-4 rounded-[28px] border border-indigo-100 flex items-center gap-3">
                <Clock className="text-indigo-600" size={28}/>
                <span className="text-4xl font-black text-indigo-600 tabular-nums">{formatTime(timer)}</span>
              </div>
            </div>
            
            <div className="space-y-10 pb-20">
              {currentExam.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-12 rounded-[56px] shadow-sm border border-slate-100">
                  <div className="flex gap-6 mb-10">
                    <span className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black flex-shrink-0 text-xl shadow-xl">{idx+1}</span>
                    <p className="text-2xl font-bold text-slate-800 leading-relaxed pt-2">{q.prompt}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 ml-0 md:ml-20">
                    {q.options.map((opt, oIdx) => (
                      <button 
                        key={oIdx} 
                        onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})}
                        className={`p-7 rounded-[32px] border-2 text-left font-bold transition-all flex items-center gap-5 text-lg ${
                          studentAnswers[q.id] === oIdx 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl shadow-indigo-200 -translate-y-1' 
                          : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-slate-100'}`}>
                          {String.fromCharCode(65+oIdx)}
                        </span>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="p-10 bg-white rounded-[56px] shadow-2xl border border-slate-100 text-center">
                <button 
                  onClick={() => { if(confirm("Em chắc chắn muốn nộp bài?")) submitTest(); }}
                  className="w-full max-w-lg bg-emerald-500 hover:bg-emerald-600 text-white py-8 rounded-[36px] font-black text-3xl shadow-2xl shadow-emerald-100 transition-all active:scale-95"
                >
                  NỘP BÀI THI NGAY
                </button>
              </div>
            </div>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
          <div className="max-w-2xl mx-auto py-20 px-6 animate-fade-in text-center">
            <div className="bg-white p-16 rounded-[64px] shadow-2xl border border-slate-50 relative overflow-hidden">
              <div className="w-32 h-32 bg-emerald-50 text-emerald-500 rounded-[48px] flex items-center justify-center mx-auto mb-10 shadow-inner">
                <Trophy size={64}/>
              </div>
              <h2 className="text-5xl font-black text-slate-900 mb-2 tracking-tight">Tuyệt vời!</h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest mb-12">{studentName} • Lớp {className}</p>
              <div className="grid grid-cols-2 gap-8 mb-12">
                <div className="bg-indigo-50 p-10 rounded-[48px] border border-indigo-100">
                  <div className="text-6xl font-black text-indigo-600">{currentSubmission.score}<span className="text-2xl text-indigo-300">/{currentSubmission.total}</span></div>
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-3">Câu chính xác</div>
                </div>
                <div className="bg-slate-50 p-10 rounded-[48px] border border-slate-100">
                  <div className="text-6xl font-black text-slate-700">{formatTime(currentSubmission.time_spent)}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3">Thời gian hoàn thành</div>
                </div>
              </div>
              <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black text-xl hover:bg-black shadow-xl transition-all active:scale-95">
                Quay lại Trang Chủ
              </button>
            </div>
          </div>
        )}

        {mode === AppMode.VIEW_SUBMISSIONS && currentExam && (
          <div className="max-w-6xl mx-auto p-6 space-y-10 animate-fade-in pb-20">
            <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold mb-4 transition-all">
              <ArrowLeft size={22}/> Quay lại Quản lý
            </button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm flex items-center gap-6">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center shadow-sm"><Users size={32}/></div>
                <div>
                  <div className="text-4xl font-black text-slate-900">{submissions.filter(s => s.exam_id === currentExam.id).length}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Học sinh nộp bài</div>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm flex items-center gap-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center shadow-sm"><CheckCircle2 size={32}/></div>
                <div>
                  <div className="text-4xl font-black text-slate-900">
                    {submissions.filter(s => s.exam_id === currentExam.id).length > 0 
                      ? (submissions.filter(s => s.exam_id === currentExam.id).reduce((a,b)=>a+b.score,0) / submissions.filter(s => s.exam_id === currentExam.id).length).toFixed(1) 
                      : 0}
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm trung bình</div>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm flex items-center gap-6">
                <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-3xl flex items-center justify-center shadow-sm"><Trophy size={32}/></div>
                <div>
                  <div className="text-4xl font-black text-slate-900">
                    {submissions.filter(s => s.exam_id === currentExam.id).length > 0 
                      ? Math.max(...submissions.filter(s => s.exam_id === currentExam.id).map(s => s.score)) 
                      : 0}
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm cao nhất</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[48px] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-2xl font-black text-slate-900">Chi tiết bảng điểm</h3>
                <span className="text-sm font-bold text-slate-400 italic">{currentExam.title}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                      <th className="px-10 py-6">Học Sinh</th>
                      <th className="px-10 py-6">Lớp</th>
                      <th className="px-10 py-6">Kết quả</th>
                      <th className="px-10 py-6">Thời gian</th>
                      <th className="px-10 py-6 text-right">Ngày nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                      <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="px-10 py-6 font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">{s.student_name}</td>
                        <td className="px-10 py-6"><span className="bg-slate-100 px-4 py-1.5 rounded-xl text-xs font-black text-slate-500 uppercase">Lớp {s.class_name}</span></td>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-indigo-600">{s.score}</span>
                            <span className="text-sm text-slate-300 font-bold">/ {s.total}</span>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-slate-400 font-bold">{formatTime(s.time_spent)}</td>
                        <td className="px-10 py-6 text-right text-slate-400 text-xs font-medium">{new Date(s.submitted_at).toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                    {submissions.filter(s => s.exam_id === currentExam.id).length === 0 && (
                      <tr><td colSpan={5} className="text-center py-28 text-slate-400 font-black italic opacity-30 text-xl">Chưa có kết quả nộp bài.</td></tr>
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
