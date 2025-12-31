
import React, { useState, useEffect } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText, gradeEssayWithAI } from './services/geminiService';
import { supabase, isSupabaseConfigured, getSupabaseConfig } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, Trash2, Trophy, Clock, Users, ArrowLeft, 
  Database, Settings, RefreshCw, CheckCircle2, CloudLightning, 
  ClipboardList, Info, Save, Activity, Eye, FileText, ChevronRight, XCircle, Loader2, Link2, Copy, Lock, Key
} from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.ADMIN_LOGIN);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  
  const [showSetup, setShowSetup] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [inputPasscode, setInputPasscode] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');

  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [examCodeInput, setExamCodeInput] = useState('');
  const [studentAnswers, setStudentAnswers] = useState<Record<string, any>>({});
  const [currentSubmission, setCurrentSubmission] = useState<StudentSubmission | null>(null);
  const [timer, setTimer] = useState(0);

  const configured = isSupabaseConfigured();
  const savedPasscode = localStorage.getItem('ST_ADMIN_PASSCODE') || '';

  const isAdminAuthenticated = () => localStorage.getItem('ST_IS_ADMIN') === 'true';

  const getPortableLink = (hash: string = '') => {
    const { url, key } = getSupabaseConfig();
    const baseUrl = window.location.origin + window.location.pathname;
    if (!url || !key) return baseUrl + hash;
    return `${baseUrl}?s_url=${encodeURIComponent(url)}&s_key=${encodeURIComponent(key)}${hash}`;
  };

  useEffect(() => {
    if (!configured) return;
    fetchInitialData();
    const channel = supabase.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public', table: '*' }, () => fetchInitialData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [configured]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#hocsinh') setMode(AppMode.STUDENT_ENTRY);
      else if (isAdminAuthenticated()) setMode(AppMode.TEACHER_DASHBOARD);
      else setMode(AppMode.ADMIN_LOGIN);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    let interval: any;
    if (mode === AppMode.STUDENT_EXAM) interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [mode]);

  const fetchInitialData = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data: exData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      setExams(exData || []);
      const { data: subData } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
      setSubmissions(subData || []);
    } catch (e) { console.error("Lỗi tải dữ liệu:", e); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setLoadingStep('AI đang phân tích file Word...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      const extracted = await extractQuestionsFromText(result.value);
      setCurrentExam({ 
        id: crypto.randomUUID(), 
        exam_code: Math.random().toString(36).substring(2, 8).toUpperCase(), 
        title: extracted.title, 
        questions: extracted.questions, 
        is_open: true, 
        created_at: new Date().toISOString() 
      });
      setMode(AppMode.EXAM_SETUP);
    } catch (error: any) { alert(error.message); }
    finally { setIsProcessing(false); }
  };

  const deleteExam = async (examId: string) => {
    if(!confirm("Xác nhận xóa đề thi và toàn bộ kết quả? Thao tác này không thể hoàn tác.")) return;
    setIsProcessing(true);
    setLoadingStep("Đang dọn dẹp dữ liệu Cloud...");
    try {
      // 1. Xóa bài nộp trước để tránh lỗi ràng buộc khóa ngoại
      const { error: subErr } = await supabase.from('submissions').delete().eq('exam_id', examId);
      if (subErr) throw subErr;
      
      // 2. Xóa đề thi
      const { error: exErr } = await supabase.from('exams').delete().eq('id', examId);
      if (exErr) throw exErr;

      // 3. Cập nhật local state ngay lập tức để tránh độ trễ realtime
      setExams(prev => prev.filter(e => e.id !== examId));
      setSubmissions(prev => prev.filter(s => s.exam_id !== examId));
      
      alert("Đã xóa vĩnh viễn đề thi thành công!");
    } catch (e: any) {
      alert("Lỗi xóa: " + e.message + "\n\nLưu ý: Bạn cần cấp quyền DELETE trong Supabase RLS policies.");
    } finally {
      setIsProcessing(false);
      fetchInitialData();
    }
  };

  const handleAdminLogin = () => {
    if (loginPasscode === savedPasscode || (!savedPasscode && loginPasscode === '1234')) {
      localStorage.setItem('ST_IS_ADMIN', 'true');
      setMode(AppMode.TEACHER_DASHBOARD);
    } else {
      alert("Mật mã không chính xác!");
    }
  };

  const handleStudentSubmit = async () => {
    if(!currentExam) return;
    if(!confirm("Bạn có chắc chắn muốn nộp bài?")) return;

    setIsProcessing(true);
    setLoadingStep('AI đang chấm điểm...');

    try {
      let score = 0;
      const finalAnswers: Record<string, any> = {};
      
      for (const q of currentExam.questions) {
        const studentAns = studentAnswers[q.id];
        
        if (q.type === 'mcq') {
          // Ép kiểu chắc chắn là Number để so khớp chính xác
          const isCorrect = Number(studentAns) === Number(q.correctAnswerIndex);
          if (isCorrect) score += 1;
          finalAnswers[q.id] = { value: studentAns, type: 'mcq' };
        } else {
          const aiScore = studentAns ? await gradeEssayWithAI(q.prompt, studentAns, q.sampleAnswer || "") : 0;
          score += aiScore;
          finalAnswers[q.id] = { value: studentAns || "", type: 'essay', ai_score: aiScore };
        }
      }

      const payload = { 
        id: crypto.randomUUID(), 
        exam_id: currentExam.id, 
        student_name: studentName, 
        class_name: className, 
        answers: finalAnswers, 
        score: score, 
        total: currentExam.questions.length, 
        time_spent: timer, 
        submitted_at: new Date().toISOString() 
      };

      const { error } = await supabase.from('submissions').insert([payload]);
      if (error) throw error;

      setCurrentSubmission(payload as any);
      setMode(AppMode.STUDENT_RESULT);
    } catch (error: any) {
      alert("Lỗi nộp bài: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // UI RENDER LOGIC
  if (showSetup) {
    const currentCfg = getSupabaseConfig();
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white p-10 rounded-[40px] shadow-2xl border border-slate-200 animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg"><Database size={28}/></div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Cấu hình Cloud</h2>
            </div>
            <button onClick={() => setShowSetup(false)} className="text-slate-400 p-2 hover:bg-slate-100 rounded-full"><XCircle/></button>
          </div>
          <div className="space-y-6 mb-10">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Supabase URL</label>
              <input type="text" className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold" value={inputUrl || currentCfg.url} onChange={e => setInputUrl(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Anon Key</label>
              <textarea className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold h-20" value={inputKey || currentCfg.key} onChange={e => setInputKey(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-indigo-400 uppercase mb-2 ml-1">Mật mã Quản trị</label>
              <input type="password" placeholder="Mặc định là 1234" className="w-full p-4 rounded-xl bg-indigo-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold text-indigo-600" value={inputPasscode} onChange={e => setInputPasscode(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { 
            localStorage.setItem('ST_SUPABASE_URL', inputUrl.trim()); 
            localStorage.setItem('ST_SUPABASE_ANON_KEY', inputKey.trim()); 
            if (inputPasscode) localStorage.setItem('ST_ADMIN_PASSCODE', inputPasscode.trim());
            window.location.reload(); 
          }} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-700 transition-all">LƯU CẤU HÌNH</button>
        </div>
      </div>
    );
  }

  if (mode === AppMode.ADMIN_LOGIN) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-[56px] shadow-2xl text-center animate-fade-in">
          <div className="w-20 h-20 bg-indigo-600 rounded-[28px] flex items-center justify-center text-white mx-auto mb-8 shadow-xl"><Lock size={40}/></div>
          <h2 className="text-3xl font-black text-slate-800 mb-2">Khu vực Bảo mật</h2>
          <p className="text-slate-400 font-medium mb-10">Vui lòng nhập mật mã giáo viên</p>
          <input 
            type="password" 
            placeholder="••••••" 
            className="w-full p-6 rounded-3xl bg-slate-100 border-2 border-transparent focus:border-indigo-600 outline-none font-black text-4xl tracking-[0.5em] text-center mb-8" 
            value={loginPasscode} 
            onChange={e => setLoginPasscode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
          />
          <button onClick={handleAdminLogin} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black text-xl shadow-xl hover:bg-indigo-700">XÁC NHẬN</button>
          <button onClick={() => window.location.hash = '#hocsinh'} className="mt-8 text-indigo-600 font-bold text-sm block mx-auto">Tôi là Học sinh</button>
        </div>
      </div>
    );
  }

  const isStudentMode = mode === AppMode.STUDENT_ENTRY || mode === AppMode.STUDENT_EXAM || mode === AppMode.STUDENT_RESULT;

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900 font-['Inter']">
      <header className="bg-white/90 border-b border-slate-100 py-4 px-6 sticky top-0 z-[100] backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { localStorage.removeItem('ST_IS_ADMIN'); window.location.hash = ''; window.location.reload(); }}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg"><GraduationCap size={24}/></div>
            <span className="text-xl font-black text-slate-900">Edu<span className="text-indigo-600">Cloud</span></span>
          </div>
          {!isStudentMode && (
            <div className="flex items-center gap-3">
               <button onClick={() => { navigator.clipboard.writeText(getPortableLink()); alert("Đã copy Link Quản trị!"); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2"><Copy size={14}/> LINK QUẢN TRỊ</button>
               <button onClick={() => setShowSetup(true)} className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400"><Settings size={20}/></button>
               <button onClick={() => { localStorage.removeItem('ST_IS_ADMIN'); window.location.reload(); }} className="p-2.5 hover:bg-red-50 rounded-xl text-red-400"><XCircle size={20}/></button>
            </div>
          )}
        </div>
      </header>

      <main className="py-8 px-6 max-w-7xl mx-auto">
        {isProcessing && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center">
            <div className="bg-white p-12 rounded-[48px] shadow-2xl text-center max-w-sm animate-fade-in">
              <Loader2 size={48} className="text-indigo-600 animate-spin mx-auto mb-6"/>
              <h2 className="text-2xl font-black text-slate-800 mb-2">{loadingStep}</h2>
              <p className="text-slate-400 font-medium">Đang xử lý dữ liệu Cloud...</p>
            </div>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && configured && (
          <div className="space-y-10 animate-fade-in">
             <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-12 rounded-[48px] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-center md:text-left"><h1 className="text-4xl font-black mb-4 tracking-tight">Khu vực Giáo viên 📚</h1><p className="text-indigo-100 text-lg opacity-80">Quản lý và chấm thi tập trung.</p></div>
                <label className="bg-white text-indigo-600 px-10 py-5 rounded-[28px] font-black text-xl shadow-xl hover:scale-105 transition-all cursor-pointer flex items-center gap-3">
                  <Plus size={24}/> TẢI ĐỀ (.docx)
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                </label>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col min-h-[300px] hover:shadow-xl transition-all">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">ID: {exam.exam_code}</span>
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black ${exam.is_open ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-400'}`}>{exam.is_open ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-6 line-clamp-2 h-14 leading-tight">{exam.title}</h3>
                    <div className="mt-auto flex gap-2">
                       <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg">BÀI LÀM</button>
                       <button onClick={() => { const link = getPortableLink('#hocsinh'); navigator.clipboard.writeText(link); alert("Đã copy link Học sinh!"); }} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600"><Share2 size={18}/></button>
                       <button onClick={() => deleteExam(exam.id)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-red-500"><Trash2 size={18}/></button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {mode === AppMode.VIEW_SUBMISSIONS && currentExam && (
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
             <div className="flex justify-between items-center">
                <button onClick={() => {setMode(AppMode.TEACHER_DASHBOARD); setSelectedSubmission(null);}} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm"><ArrowLeft size={24}/></button>
                <div className="text-center">
                   <h1 className="text-3xl font-black text-slate-800">{currentExam.title}</h1>
                   <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Danh sách bài nộp</p>
                </div>
                <div className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest border border-emerald-100">Bảo mật</div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                   {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => setSelectedSubmission(s)}
                        className={`p-6 rounded-3xl border-2 transition-all cursor-pointer ${selectedSubmission?.id === s.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl' : 'bg-white border-slate-50 hover:border-indigo-100'}`}
                      >
                         <div className="font-black text-lg">{s.student_name}</div>
                         <div className={`text-xs font-bold ${selectedSubmission?.id === s.id ? 'text-indigo-100' : 'text-slate-400'}`}>{s.class_name} • {Math.floor(s.time_spent / 60)}p</div>
                         <div className="mt-4 font-black">
                            <span className={`px-4 py-1.5 rounded-xl text-xs ${selectedSubmission?.id === s.id ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>Điểm: {Number(s.score).toFixed(1)}/{s.total}</span>
                         </div>
                      </div>
                   ))}
                </div>
                
                <div className="lg:col-span-2 bg-white rounded-[48px] shadow-2xl border border-slate-100 p-12 overflow-y-auto max-h-[75vh] custom-scrollbar">
                   {selectedSubmission ? (
                     <div className="space-y-12 animate-fade-in">
                        <div className="border-b border-slate-100 pb-10 flex justify-between items-end">
                           <div>
                              <h2 className="text-4xl font-black text-slate-800 mb-2">{selectedSubmission.student_name}</h2>
                              <p className="text-slate-400 font-bold text-sm uppercase">Lớp: {selectedSubmission.class_name}</p>
                           </div>
                           <div className="bg-slate-900 text-white px-10 py-6 rounded-[32px] text-center shadow-xl">
                              <div className="text-4xl font-black">{Number(selectedSubmission.score).toFixed(1)}</div>
                              <div className="text-[10px] font-black text-slate-500 uppercase mt-1">Tổng điểm</div>
                           </div>
                        </div>
                        <div className="space-y-10">
                           {currentExam.questions.map((q, idx) => {
                             const ans = selectedSubmission.answers[q.id];
                             const studentValue = Number(ans?.value);
                             const correctIndex = Number(q.correctAnswerIndex);
                             const isCorrectMCQ = q.type === 'mcq' && studentValue === correctIndex;
                             
                             return (
                               <div key={idx} className={`p-8 rounded-[40px] border-2 transition-all ${q.type === 'mcq' && isCorrectMCQ ? 'bg-emerald-50/30 border-emerald-100' : 'bg-slate-50 border-slate-50'}`}>
                                  <div className="flex justify-between items-start mb-6">
                                     <p className="font-black text-slate-800 text-xl pr-10">Câu {idx+1}: {q.prompt}</p>
                                     <span className={`shrink-0 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase ${q.type === 'mcq' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {q.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}
                                     </span>
                                  </div>
                                  {q.type === 'mcq' ? (
                                    <div className="space-y-4">
                                       <div className={`p-6 rounded-3xl border-2 font-bold ${isCorrectMCQ ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-red-50 border-red-100 text-red-800'}`}>
                                          <div className={`text-[10px] uppercase mb-3 ${isCorrectMCQ ? 'text-white/70' : 'opacity-60'}`}>Học sinh đã chọn:</div>
                                          <div className="flex items-center gap-4">
                                             <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg text-xl ${isCorrectMCQ ? 'bg-white text-emerald-600' : 'bg-red-500 text-white'}`}>
                                                {ans?.value !== undefined ? String.fromCharCode(65 + studentValue) : '?'}
                                             </span>
                                             <span className="text-xl">{ans?.value !== undefined ? q.options?.[studentValue] : '(Bỏ trống)'}</span>
                                          </div>
                                       </div>
                                       {!isCorrectMCQ && (
                                         <div className="px-6 py-4 bg-emerald-50 text-emerald-700 rounded-3xl border border-emerald-100 text-sm font-bold flex items-center gap-3">
                                            <div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center shadow-sm">{String.fromCharCode(65 + correctIndex)}</div>
                                            Đáp án đúng là: {q.options?.[correctIndex]}
                                         </div>
                                       )}
                                    </div>
                                  ) : (
                                    <div className="space-y-5">
                                       <div className="bg-white p-8 rounded-3xl border-2 border-indigo-100 font-medium text-slate-800 shadow-inner">
                                          <div className="text-[10px] font-black text-indigo-400 uppercase mb-4">Bài làm học sinh:</div>
                                          <div className="text-xl italic">{ans?.value || '(Để trống)'}</div>
                                       </div>
                                       <div className="flex flex-col md:flex-row gap-4">
                                          <div className="flex-1 bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                                             <span className="font-black text-emerald-700 uppercase text-[10px] block mb-2">Gợi ý đáp án:</span>
                                             <span className="text-emerald-900 text-sm">{q.sampleAnswer || "N/A"}</span>
                                          </div>
                                          <div className="md:w-32 bg-indigo-600 text-white p-6 rounded-3xl flex flex-col items-center justify-center shadow-lg">
                                             <span className="text-[10px] font-black uppercase opacity-60 mb-1">AI Score</span>
                                             <span className="text-3xl font-black">{ans?.ai_score ?? 0}</span>
                                          </div>
                                       </div>
                                    </div>
                                  )}
                               </div>
                             );
                           })}
                        </div>
                     </div>
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center text-slate-200">
                        <Eye size={80} className="mb-6 opacity-30"/>
                        <p className="font-black text-2xl">Chọn bài nộp để xem chi tiết</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_ENTRY && (
          <div className="max-w-md mx-auto py-20 animate-fade-in">
             <div className="bg-white p-12 rounded-[64px] shadow-2xl text-center border border-slate-50">
                <div className="w-24 h-24 bg-indigo-600 rounded-[32px] flex items-center justify-center text-white mx-auto mb-10 shadow-2xl rotate-3"><FileText size={48}/></div>
                <h2 className="text-4xl font-black mb-10 text-slate-800 tracking-tighter">Vào Phòng Thi</h2>
                <div className="space-y-4 mb-10 text-left">
                   <input type="text" placeholder="Họ và tên học sinh" className="w-full p-6 rounded-[24px] bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold text-lg" value={studentName} onChange={e => setStudentName(e.target.value)} />
                   <input type="text" placeholder="Lớp" className="w-full p-6 rounded-[24px] bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold text-lg" value={className} onChange={e => setClassName(e.target.value)} />
                   <input type="text" placeholder="MÃ PHÒNG" className="w-full p-8 rounded-[24px] bg-slate-900 text-white text-center font-black text-3xl tracking-widest uppercase shadow-xl" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
                </div>
                <button onClick={async () => {
                   if(!studentName || !className || !examCodeInput) return alert("Vui lòng điền đủ thông tin!");
                   setIsProcessing(true);
                   try {
                      const { data, error } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
                      if(error || !data) return alert("Không tìm thấy mã phòng!");
                      if(!data.is_open) return alert("Phòng thi hiện đã đóng!");
                      setCurrentExam(data); setMode(AppMode.STUDENT_EXAM); setTimer(0);
                   } finally { setIsProcessing(false); }
                }} className="w-full bg-indigo-600 text-white py-7 rounded-[32px] font-black text-2xl hover:bg-indigo-700 shadow-2xl">BẮT ĐẦU</button>
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-32">
             <div className="bg-white/90 p-6 rounded-3xl shadow-xl sticky top-24 z-50 flex justify-between items-center border border-slate-100">
                <div className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-xs">CÂU {Object.keys(studentAnswers).length}/{currentExam.questions.length}</div>
                <div className="text-2xl font-black text-indigo-600 bg-indigo-50 px-6 py-2 rounded-2xl tracking-tighter"><Clock size={20} className="inline mr-2 mb-1"/> {Math.floor(timer / 60).toString().padStart(2, '0')}:{(timer % 60).toString().padStart(2, '0')}</div>
             </div>
             {currentExam.questions.map((q, idx) => (
                <div key={idx} className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 relative">
                   <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl text-[9px] font-black uppercase ${q.type === 'mcq' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>{q.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}</div>
                   <p className="text-xl font-bold text-slate-800 mb-8"><span className="text-indigo-600 mr-2">Câu {idx+1}:</span> {q.prompt}</p>
                   {q.type === 'mcq' ? (
                     <div className="grid grid-cols-1 gap-4">
                        {q.options?.map((opt, oIdx) => (
                          <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`p-6 rounded-2xl border-2 font-bold text-left flex items-center gap-4 transition-all ${studentAnswers[q.id] === oIdx ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'}`}>
                             <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-white text-indigo-600 shadow-sm'}`}>{String.fromCharCode(65+oIdx)}</span>
                             {opt}
                          </button>
                        ))}
                     </div>
                   ) : (
                     <textarea className="w-full p-8 rounded-[32px] bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-medium text-lg min-h-[200px]" placeholder="Viết câu trả lời của em tại đây..." value={studentAnswers[q.id] || ''} onChange={(e) => setStudentAnswers({...studentAnswers, [q.id]: e.target.value})} />
                   )}
                </div>
             ))}
             <button onClick={handleStudentSubmit} className="w-full bg-emerald-500 text-white py-8 rounded-[40px] font-black text-3xl shadow-2xl hover:bg-emerald-600 transition-all">NỘP BÀI THI</button>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
          <div className="max-w-md mx-auto py-20 text-center animate-fade-in">
             <div className="bg-white p-16 rounded-[72px] shadow-2xl border border-slate-50">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner"><CheckCircle2 size={56}/></div>
                <h2 className="text-4xl font-black mb-3 text-slate-800">Hoàn tất!</h2>
                <div className="bg-slate-900 text-white p-12 rounded-[48px] mb-12 shadow-2xl scale-105">
                   <div className="text-[10px] font-black uppercase mb-4 text-slate-500 tracking-widest">Điểm của em</div>
                   <div className="text-7xl font-black">{Number(currentSubmission.score).toFixed(1)}<span className="text-3xl text-slate-500 ml-1">/{currentSubmission.total}</span></div>
                   <p className="mt-4 text-[10px] font-bold text-emerald-400">ĐÃ LƯU TRÊN CLOUD</p>
                </div>
                <button onClick={() => window.location.reload()} className="w-full py-4 text-slate-400 font-black hover:text-slate-900 transition-colors uppercase text-xs tracking-widest">Quay lại trang chủ</button>
             </div>
          </div>
        )}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
             <div className="bg-white/90 p-10 rounded-[40px] shadow-xl border border-emerald-100 sticky top-24 z-50 flex justify-between items-center backdrop-blur-md">
                <div><h2 className="text-3xl font-black text-emerald-600">AI đã tách đề xong!</h2><p className="text-slate-500 font-medium">Kiểm tra lại đáp án đúng trước khi lưu.</p></div>
                <button onClick={async () => { await supabase.from('exams').insert([currentExam]); fetchInitialData(); setMode(AppMode.TEACHER_DASHBOARD); }} className="bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black text-xl shadow-lg hover:bg-indigo-700 transition-all">XUẤT BẢN ĐỀ</button>
             </div>
             {currentExam.questions.map((q, idx) => (
               <div key={idx} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm relative group">
                  <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl text-[10px] font-black uppercase ${q.type === 'mcq' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>{q.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}</div>
                  <p className="font-bold text-xl mb-8 pr-12">Câu {idx+1}: {q.prompt}</p>
                  {q.type === 'mcq' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {q.options?.map((opt, oIdx) => (
                         <div key={oIdx} className={`p-5 rounded-2xl border-2 font-bold ${oIdx === Number(q.correctAnswerIndex) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                           <span className="mr-3 opacity-40">{String.fromCharCode(65+oIdx)}.</span> {opt}
                         </div>
                       ))}
                    </div>
                  ) : (
                    <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 font-medium text-emerald-900 text-sm">
                       <span className="text-[10px] font-black uppercase opacity-60 block mb-1">Đáp án mẫu:</span>
                       {q.sampleAnswer || "N/A"}
                    </div>
                  )}
               </div>
             ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
