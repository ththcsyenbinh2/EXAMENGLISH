
import React, { useState, useEffect } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, ChevronRight, Loader2, Trash2, 
  Trophy, Clock, Users, ArrowLeft, Database,
  Lock, Unlock, UserCircle, BarChart3, PieChart,
  ClipboardList, LayoutDashboard, FileText
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

  useEffect(() => {
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
      console.error("Database error", e);
    } finally {
      setIsDbLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setLoadingStep('Đang đọc file Word...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      setLoadingStep('AI đang phân tích câu hỏi...');
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
      alert(`Lỗi xử lý: ${error.message || "Vui lòng kiểm tra lại API Key trong cài đặt môi trường."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveExam = async () => {
    if (!currentExam) return;
    if (!isSupabaseConfigured()) return alert("Vui lòng cấu hình Supabase URL và Key để lưu dữ liệu!");
    setIsDbLoading(true);
    const { error } = await supabase.from('exams').insert([currentExam]);
    if (!error) {
      await fetchInitialData();
      setMode(AppMode.TEACHER_DASHBOARD);
    } else alert("Lỗi lưu trữ: " + error.message);
    setIsDbLoading(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 py-4 px-8 sticky top-0 z-[100] shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.hash = ''}>
            <div className="bg-indigo-600 p-2 rounded-xl text-white"><GraduationCap size={24}/></div>
            <span className="text-xl font-black tracking-tight">AI <span className="text-indigo-600">ExamCloud</span></span>
          </div>
          <div className="flex items-center gap-4">
            {isDbLoading && <Loader2 className="animate-spin text-indigo-600" size={20}/>}
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden md:inline">Hệ thống khảo thí thông minh</span>
          </div>
        </div>
      </header>

      <main className="py-8 px-6 max-w-7xl mx-auto">
        {isProcessing && (
          <div className="max-w-xl mx-auto p-12 bg-white rounded-3xl text-center shadow-xl border border-slate-100 animate-pulse mb-8">
            <Loader2 className="animate-spin w-12 h-12 text-indigo-600 mx-auto mb-4"/>
            <h2 className="text-xl font-bold text-slate-800">{loadingStep}</h2>
            <p className="text-slate-400 text-sm mt-2">Đang sử dụng Gemini 3 Flash để bóc tách dữ liệu...</p>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h1 className="text-3xl font-black flex items-center gap-3 text-slate-800"><LayoutDashboard size={32} className="text-indigo-600"/> Dashboard Giáo viên</h1>
                <p className="text-slate-500 font-medium">Quản lý đề thi và theo dõi kết quả của học sinh theo thời gian thực.</p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button onClick={() => window.location.hash = 'hocsinh'} className="flex-1 md:flex-none bg-white border border-slate-200 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm">
                  <UserCircle size={20}/> Chế độ Học sinh
                </button>
                <label className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-100 transition-all active:scale-95">
                  <Plus size={20}/> <span>Tạo đề từ Word</span>
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exams.map(exam => (
                <div key={exam.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-full h-1.5 ${exam.is_open ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">MÃ: {exam.exam_code}</span>
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
                      <div className="text-2xl font-black text-slate-800">{submissions.filter(s => s.exam_id === exam.id).length}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lượt thi</div>
                    </div>
                    <div className="w-px h-8 bg-slate-100"></div>
                    <div>
                      <div className="text-2xl font-black text-slate-800">{exam.questions.length}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Câu hỏi</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all">
                      <BarChart3 size={18}/> Xem bảng điểm
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#hocsinh`); alert("Đã copy link học sinh!"); }} className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-100 transition-all">
                        <Share2 size={14}/> Copy Link
                      </button>
                      <button onClick={async () => { if(confirm("Xác nhận xóa đề thi này vĩnh viễn?")) { await supabase.from('exams').delete().eq('id', exam.id); fetchInitialData(); } }} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 border border-red-50 transition-colors">
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {exams.length === 0 && !isDbLoading && (
                <div className="col-span-full py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                  <div className="bg-slate-50 p-6 rounded-full mb-4"><FileText size={48} className="opacity-20"/></div>
                  <p className="font-bold text-lg">Chưa có đề thi nào trên hệ thống.</p>
                  <p className="text-sm">Hãy tải lên một file Word (.docx) để AI bóc tách đề thi ngay!</p>
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
              <h2 className="text-2xl font-black text-center mb-8 tracking-tight text-slate-800">Cổng Thi Trực Tuyến</h2>
              <div className="space-y-4 mb-8">
                <input type="text" placeholder="Nhập họ và tên" className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none font-bold transition-all" value={studentName} onChange={e => setStudentName(e.target.value)} />
                <input type="text" placeholder="Nhập lớp (Ví dụ: 10A2)" className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none font-bold transition-all" value={className} onChange={e => setClassName(e.target.value)} />
                <input type="text" placeholder="MÃ PHÒNG THI" className="w-full p-5 rounded-2xl bg-indigo-50 border-2 border-indigo-200 focus:border-indigo-600 focus:bg-white outline-none font-black text-indigo-600 text-center uppercase tracking-[0.4em] text-2xl transition-all" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
              </div>
              <button onClick={async () => {
                if (!studentName || !className || !examCodeInput) return alert("Vui lòng điền đầy đủ thông tin!");
                setIsDbLoading(true);
                const { data } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
                if (data && data.is_open) {
                  setCurrentExam(data); setStudentAnswers({}); setTimer(0); setMode(AppMode.STUDENT_EXAM);
                } else alert("Mã đề không hợp lệ hoặc phòng thi đã đóng!");
                setIsDbLoading(false);
              }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-[28px] font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-indigo-200">
                BẮT ĐẦU THI <ChevronRight size={24}/>
              </button>
            </div>
          </div>
        )}

        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-lg sticky top-20 z-50 flex justify-between items-center border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black">{currentExam.questions.length}</div>
                <div>
                  <h2 className="font-bold text-slate-800 leading-tight line-clamp-1">{currentExam.title}</h2>
                  <p className="text-xs font-bold text-indigo-600">{studentName} - {className}</p>
                </div>
              </div>
              <div className="bg-indigo-50 px-5 py-2.5 rounded-xl border border-indigo-100 flex items-center gap-2 text-indigo-600">
                <Clock size={20}/> <span className="text-2xl font-black tabular-nums">{formatTime(timer)}</span>
              </div>
            </div>
            <div className="space-y-6">
              {currentExam.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 hover:border-indigo-100 transition-all">
                  <div className="flex gap-4 mb-6">
                    <span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black flex-shrink-0 text-sm">{idx+1}</span>
                    <p className="text-lg font-bold text-slate-800 leading-relaxed pt-1">{q.prompt}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((opt, oIdx) => (
                      <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`p-5 rounded-2xl border-2 text-left font-bold transition-all flex items-center gap-4 ${studentAnswers[q.id] === oIdx ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-50 text-slate-600 hover:bg-slate-50'}`}>
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-slate-100'}`}>{String.fromCharCode(65+oIdx)}</span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={async () => {
                if(!confirm("Xác nhận nộp bài? Bạn không thể sửa đáp án sau khi nộp.")) return;
                let score = 0;
                currentExam.questions.forEach(q => { if(studentAnswers[q.id] === q.correctAnswerIndex) score++; });
                const payload = { exam_id: currentExam.id, student_name: studentName, class_name: className, answers: studentAnswers, score, total: currentExam.questions.length, time_spent: timer, submitted_at: new Date().toISOString() };
                const { data, error } = await supabase.from('submissions').insert([payload]).select().single();
                if (!error) { setCurrentSubmission(data); setMode(AppMode.STUDENT_RESULT); }
              }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-[32px] font-black text-2xl shadow-xl shadow-emerald-100 transition-all active:scale-95 mt-8">NỘP BÀI THI</button>
            </div>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
          <div className="max-w-md mx-auto py-12 animate-fade-in text-center">
            <div className="bg-white p-12 rounded-[56px] shadow-2xl border border-slate-50">
              <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8"><Trophy size={48}/></div>
              <h2 className="text-3xl font-black mb-2 text-slate-800">Hoàn Thành!</h2>
              <p className="text-slate-400 font-bold mb-10">{studentName} • Lớp {className}</p>
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                  <div className="text-4xl font-black text-indigo-600">{currentSubmission.score}<span className="text-sm text-indigo-300">/{currentSubmission.total}</span></div>
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Câu đúng</div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div className="text-2xl font-black text-slate-600">{formatTime(currentSubmission.time_spent)}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Thời gian</div>
                </div>
              </div>
              <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold hover:bg-black transition-all">Về Trang Chủ</button>
            </div>
          </div>
        )}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Đã bóc tách đề thành công!</h2>
                <p className="text-slate-500 text-sm">Hệ thống đã nhận diện được {currentExam.questions.length} câu hỏi trắc nghiệm từ file của bạn.</p>
              </div>
              <button onClick={saveExam} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-indigo-100 transition-all active:scale-95">
                <Database size={20}/> Lưu & Xuất Bản Đề
              </button>
            </div>
            <div className="space-y-4">
              {currentExam.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-[32px] border border-slate-200">
                  <div className="flex gap-4 mb-6">
                    <span className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-black text-xs">{idx+1}</span>
                    <p className="font-bold text-slate-800 pt-1 leading-relaxed">{q.prompt}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-12">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className={`p-4 rounded-xl border-2 transition-all ${oIdx === q.correctAnswerIndex ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'bg-slate-50 border-transparent text-slate-500'}`}>
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
          <div className="space-y-8 animate-fade-in pb-20">
            <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold transition-colors group"><ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform"/> Quay lại Dashboard</button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><Users size={24}/></div>
                <div>
                  <div className="text-3xl font-black text-slate-800">{submissions.filter(s => s.exam_id === currentExam.id).length}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Học sinh nộp bài</div>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><PieChart size={24}/></div>
                <div>
                  <div className="text-3xl font-black text-slate-800">
                    {submissions.filter(s => s.exam_id === currentExam.id).length > 0 
                      ? (submissions.filter(s => s.exam_id === currentExam.id).reduce((a,b)=>a+b.score,0) / submissions.filter(s => s.exam_id === currentExam.id).length).toFixed(1) 
                      : "0"}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Điểm TB (Câu đúng)</div>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shadow-inner"><Trophy size={24}/></div>
                <div>
                  <div className="text-3xl font-black text-slate-800">
                    {submissions.filter(s => s.exam_id === currentExam.id).length > 0 
                      ? Math.max(...submissions.filter(s => s.exam_id === currentExam.id).map(s => s.score)) 
                      : "0"}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Điểm cao nhất</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
                <h3 className="text-xl font-black text-slate-800">Kết quả chi tiết: {currentExam.title}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5">Tên Học Sinh</th>
                      <th className="px-8 py-5">Lớp</th>
                      <th className="px-8 py-5">Số câu đúng</th>
                      <th className="px-8 py-5">Thời gian làm bài</th>
                      <th className="px-8 py-5 text-right">Ngày nộp bài</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-8 py-5 font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{s.student_name}</td>
                        <td className="px-8 py-5 font-bold text-indigo-600/70">{s.class_name}</td>
                        <td className="px-8 py-5">
                          <span className="text-xl font-black text-slate-800">{s.score}</span>
                          <span className="text-xs text-slate-300 font-bold ml-1">/ {s.total}</span>
                        </td>
                        <td className="px-8 py-5 text-slate-500 font-medium">{formatTime(s.time_spent)}</td>
                        <td className="px-8 py-5 text-right text-slate-400 text-xs font-bold">{new Date(s.submitted_at).toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                    {submissions.filter(s => s.exam_id === currentExam.id).length === 0 && (
                      <tr><td colSpan={5} className="text-center py-24 text-slate-400 font-bold italic opacity-40">Chưa có dữ liệu nộp bài nào cho đề thi này.</td></tr>
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
