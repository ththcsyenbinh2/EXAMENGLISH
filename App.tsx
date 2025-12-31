import React, { useState, useEffect } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText, gradeEssayWithAI } from './services/geminiService';
import { supabase, isSupabaseConfigured, getSupabaseConfig } from './services/supabase';
import {
  GraduationCap, Plus, Share2, Trash2, Trophy, Clock, Users, ArrowLeft,
  Database, Settings, RefreshCw, CheckCircle2, CloudLightning,
  ClipboardList, Info, Save, Activity, Eye, FileText, ChevronRight, XCircle, Loader2, Link2, Copy, Lock, Key, ToggleLeft, ToggleRight
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
  const isStudentMode = mode === AppMode.STUDENT_ENTRY || mode === AppMode.STUDENT_EXAM || mode === AppMode.STUDENT_RESULT;

  const getPortableLink = (hash: string = '') => {
    const { url, key } = getSupabaseConfig();
    const baseUrl = window.location.origin + window.location.pathname;
    if (!url || !key) return baseUrl + hash;
    return `${baseUrl}?s_url=${encodeURIComponent(url)}&s_key=${encodeURIComponent(key)}${hash}`;
  };

  useEffect(() => {
    if (!configured) return;
    fetchInitialData();
    const channel = supabase.channel('realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: '*' }, () => fetchInitialData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [configured]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#hocsinh') {
        setMode(AppMode.STUDENT_ENTRY);
      } else {
        if (isAdminAuthenticated()) {
          setMode(AppMode.TEACHER_DASHBOARD);
        } else {
          setMode(AppMode.ADMIN_LOGIN);
        }
      }
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
    } catch (e) {
      console.error("Lỗi Fetch Data:", e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setLoadingStep('AI đang bóc tách nội dung Word...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      const extracted = await extractQuestionsFromText(result.value);

      const newExam: Exam = {
        id: crypto.randomUUID(),
        exam_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        title: extracted.title || file.name.replace('.docx', ''),
        questions: extracted.questions.map((q: any) => ({
          ...q,
          correctAnswerIndex: q.type === 'mcq' ? null : undefined
        })),
        is_open: true,
        created_at: new Date().toISOString()
      };

      setCurrentExam(newExam);
      setMode(AppMode.EXAM_SETUP);
    } catch (error: any) {
      alert("Lỗi xử lý file: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteExam = async (id: string) => {
    if (!confirm("Xóa đề này và tất cả bài làm của học sinh?")) return;
    setIsProcessing(true);
    setLoadingStep("Đang xóa dữ liệu...");
    try {
      await supabase.from('submissions').delete().eq('exam_id', id);
      await supabase.from('exams').delete().eq('id', id);
      await fetchInitialData();
      alert("Đã xóa thành công!");
    } catch (e: any) {
      alert("Lỗi khi xóa: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleExamOpen = async (exam: Exam) => {
    const newStatus = !exam.is_open;
    try {
      await supabase.from('exams').update({ is_open: newStatus }).eq('id', exam.id);
      await fetchInitialData();
    } catch (e) {
      alert("Lỗi cập nhật trạng thái đề!");
    }
  };

  const handleAdminLogin = () => {
    if (loginPasscode === savedPasscode || (!savedPasscode && loginPasscode === '1234')) {
      localStorage.setItem('ST_IS_ADMIN', 'true');
      setMode(AppMode.TEACHER_DASHBOARD);
    } else {
      alert("Mật mã không đúng!");
    }
  };

  const handleStudentSubmit = async () => {
    if (!currentExam) return;
    if (!confirm("Xác nhận nộp bài?")) return;
    setIsProcessing(true);
    setLoadingStep('AI đang chấm điểm bài làm...');
    try {
      let mcqScore = 0;
      let essayScore = 0;
      const finalAnswers: Record<string, any> = {};

      for (const q of currentExam.questions) {
        const studentAns = studentAnswers[q.id];

        if (q.type === 'mcq') {
          const isCorrect = studentAns === q.correctAnswerIndex;
          if (isCorrect) mcqScore += 1;
          finalAnswers[q.id] = { value: studentAns, type: 'mcq', correct: isCorrect };
        } else {
          const score = studentAns ? await gradeEssayWithAI(q.prompt, studentAns, q.sampleAnswer || "") : 0;
          essayScore += score;
          finalAnswers[q.id] = { value: studentAns || "", type: 'essay', ai_score: score };
        }
      }

      const payload = {
        id: crypto.randomUUID(),
        exam_id: currentExam.id,
        student_name: studentName,
        class_name: className,
        answers: finalAnswers,
        score: mcqScore + essayScore,
        total: currentExam.questions.length,
        time_spent: timer,
        submitted_at: new Date().toISOString()
      };

      await supabase.from('submissions').insert([payload]);
      setCurrentSubmission(payload as any);
      setMode(AppMode.STUDENT_RESULT);
    } catch (error: any) {
      alert("Lỗi nộp bài: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (showSetup) {
    const currentCfg = getSupabaseConfig();
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white p-10 rounded-[40px] shadow-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-3 rounded-2xl text-white"><Database size={28}/></div>
              <h2 className="text-2xl font-black text-slate-800">Cấu hình Cloud</h2>
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
              <label className="block text-[10px] font-black text-indigo-400 uppercase mb-2 ml-1">Mật mã Giáo viên (Quan trọng)</label>
              <input type="password" placeholder="Nhập mã để bảo mật đề thi" className="w-full p-4 rounded-xl bg-indigo-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold text-indigo-600" value={inputPasscode} onChange={e => setInputPasscode(e.target.value)} />
              <p className="text-[10px] text-slate-400 mt-2 px-1 italic">Mật mã này dùng để vào trang quản trị. Đừng cho học sinh biết mã này!</p>
            </div>
          </div>
          <button onClick={() => {
            localStorage.setItem('ST_SUPABASE_URL', inputUrl.trim());
            localStorage.setItem('ST_SUPABASE_ANON_KEY', inputKey.trim());
            if (inputPasscode) localStorage.setItem('ST_ADMIN_PASSCODE', inputPasscode.trim());
            window.location.reload();
          }} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl">LƯU THIẾT LẬP</button>
        </div>
      </div>
    );
  }

  if (mode === AppMode.ADMIN_LOGIN) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-[56px] shadow-2xl text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-[28px] flex items-center justify-center text-white mx-auto mb-8 shadow-xl">
            <Lock size={40}/>
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-2">Khu vực Giáo viên</h2>
          <p className="text-slate-400 font-medium mb-10">Vui lòng nhập mật mã để tiếp tục</p>
          <div className="relative mb-8">
            <input
              type="password"
              placeholder="••••••"
              className="w-full p-6 pl-14 rounded-3xl bg-slate-100 border-2 border-transparent focus:border-indigo-600 outline-none font-black text-3xl tracking-[1em] text-center"
              value={loginPasscode}
              onChange={e => setLoginPasscode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
            />
            <Key size={24} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"/>
          </div>
          <button onClick={handleAdminLogin} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black text-xl shadow-xl hover:bg-indigo-700 transition-all">XÁC NHẬN</button>
          <div className="mt-10 flex flex-col gap-3">
             <button onClick={() => window.location.hash = '#hocsinh'} className="text-indigo-600 font-bold text-sm">Tôi là Học sinh</button>
             <button onClick={() => setShowSetup(true)} className="text-slate-400 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"><Settings size={14}/> Cấu hình Cloud</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900 font-['Inter']">
      <header className="bg-white/80 border-b border-slate-100 py-4 px-6 sticky top-0 z-[100] backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { localStorage.removeItem('ST_IS_ADMIN'); window.location.hash = ''; window.location.reload(); }}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg"><GraduationCap size={24}/></div>
            <span className="text-xl font-black text-slate-900">Edu<span className="text-indigo-600">Cloud</span></span>
          </div>
         
          {!isStudentMode && (
            <div className="flex items-center gap-3">
               <button
                onClick={() => {
                  navigator.clipboard.writeText(getPortableLink());
                  alert("Đã copy Link Quản trị! Lưu ý: Máy mới vẫn sẽ yêu cầu mật mã để vào được đây.");
                }}
                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2"
               >
                 <Copy size={14}/> LINK QUẢN TRỊ
               </button>
               <button onClick={() => setShowSetup(true)} className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-all"><Settings size={20}/></button>
               <button onClick={() => { localStorage.removeItem('ST_IS_ADMIN'); window.location.reload(); }} className="p-2.5 hover:bg-red-50 rounded-xl text-red-400"><XCircle size={20}/></button>
            </div>
          )}
        </div>
      </header>
      <main className="py-8 px-6 max-w-7xl mx-auto">
        {isProcessing && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center">
            <div className="bg-white p-12 rounded-[48px] shadow-2xl text-center max-w-sm">
              <Loader2 size={48} className="text-indigo-600 animate-spin mx-auto mb-6"/>
              <h2 className="text-2xl font-black text-slate-800 mb-2">{loadingStep}</h2>
              <p className="text-slate-400 font-medium text-sm">Đang xử lý dữ liệu an toàn...</p>
            </div>
          </div>
        )}
        {mode === AppMode.TEACHER_DASHBOARD && configured && (
          <div className="space-y-10 animate-fade-in">
             <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-12 rounded-[48px] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
                <div><h1 className="text-4xl font-black mb-4 tracking-tight">Khu vực Giáo viên 📚</h1><p className="text-indigo-100 text-lg opacity-80">Hệ thống của bạn đang được bảo vệ bởi mật mã.</p></div>
                <label className="bg-white text-indigo-600 px-10 py-5 rounded-[28px] font-black text-xl shadow-xl hover:scale-105 transition-all cursor-pointer flex items-center gap-3">
                  <Plus size={24}/> TẢI ĐỀ (.docx)
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                </label>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col min-h-[300px] hover:shadow-xl transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">PHÒNG: {exam.exam_code}</span>
                      </div>
                      <button
                        onClick={() => toggleExamOpen(exam)}
                        className={`p-2 rounded-xl transition-all ${exam.is_open ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}
                      >
                        {exam.is_open ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-6 line-clamp-2 h-14 leading-tight">{exam.title}</h3>
                    <div className="mt-auto flex gap-2">
                      <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg">XEM BÀI LÀM</button>
                      <button onClick={() => { navigator.clipboard.writeText(getPortableLink('#hocsinh')); alert("Đã copy link Học sinh!"); }} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600"><Share2 size={18}/></button>
                      <button onClick={() => deleteExam(exam.id)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-red-500"><Trash2 size={18}/></button>
                    </div>
                    <div className="mt-4 text-center">
                      <span className={`text-xs font-bold ${exam.is_open ? 'text-emerald-600' : 'text-red-500'}`}>
                        {exam.is_open ? 'ĐANG MỞ CHO HỌC SINH' : 'ĐÃ KHÓA'}
                      </span>
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
                <div className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest border border-emerald-100 flex items-center gap-2"><Activity size={16} className="animate-pulse"/> Bảo mật</div>
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
                         <div className={`text-xs font-bold ${selectedSubmission?.id === s.id ? 'text-indigo-100' : 'text-slate-400'}`}>{s.class_name} • {Math.floor(s.time_spent / 60)} phút</div>
                         <div className="mt-4 flex justify-between items-center font-black">
                            <span className={`px-4 py-1.5 rounded-xl text-xs ${selectedSubmission?.id === s.id ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>Điểm: {s.score.toFixed(1)}/{s.total}</span>
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
                              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Lớp: {selectedSubmission.class_name}</p>
                           </div>
                           <div className="bg-slate-900 text-white px-10 py-6 rounded-[32px] text-center shadow-xl">
                              <div className="text-4xl font-black">{selectedSubmission.score.toFixed(1)}</div>
                              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Tổng điểm</div>
                           </div>
                        </div>
                       
                        <div className="space-y-10">
                           {currentExam.questions.map((q, idx) => {
                             const ans = selectedSubmission.answers[q.id];
                             const studentValue = ans?.value;
                             const isCorrectMCQ = q.type === 'mcq' && studentValue === q.correctAnswerIndex;
                            
                             return (
                               <div key={idx} className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                                  <div className="flex justify-between items-start mb-6">
                                     <p className="font-black text-slate-800 text-xl leading-tight pr-10">Câu {idx+1}: {q.prompt}</p>
                                     <span className={`shrink-0 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${q.type === 'mcq' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {q.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}
                                     </span>
                                  </div>
                                 
                                  {q.type === 'mcq' ? (
                                    <div className="space-y-4">
                                       <div className={`p-6 rounded-3xl border-2 font-bold ${isCorrectMCQ ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                          <div className="text-[10px] uppercase opacity-60 mb-3">Học sinh đã chọn:</div>
                                          <div className="flex items-center gap-4">
                                             <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg text-xl ${isCorrectMCQ ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                                {studentValue !== undefined ? String.fromCharCode(65 + studentValue) : '?'}
                                             </span>
                                             <span className="text-xl">{studentValue !== undefined ? q.options?.[studentValue] : '(Không chọn)'}</span>
                                          </div>
                                       </div>
                                       <div className="px-4 text-xs font-bold text-slate-500 flex items-center gap-2">
                                          <CheckCircle2 size={16} className="text-emerald-500"/> Đáp án đúng: {String.fromCharCode(65 + (q.correctAnswerIndex || 0))}. {q.options?.[q.correctAnswerIndex || 0]}
                                       </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-5">
                                       <div className="bg-white p-8 rounded-3xl border-2 border-indigo-100 font-medium text-slate-800 leading-relaxed shadow-inner">
                                          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Câu trả lời đã nhập:</div>
                                          <div className="text-xl whitespace-pre-wrap italic">{studentValue || '(Học sinh để trống)'}</div>
                                       </div>
                                       <div className="flex flex-col md:flex-row gap-4">
                                          <div className="flex-1 bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                                             <span className="font-black text-emerald-700 uppercase text-[10px] block mb-2">Hướng dẫn chấm:</span>
                                             <span className="text-emerald-900 text-sm font-medium">{q.sampleAnswer || "N/A"}</span>
                                          </div>
                                          <div className="md:w-32 bg-indigo-600 text-white p-6 rounded-3xl flex flex-col items-center justify-center text-center shadow-lg">
                                             <span className="text-[10px] font-black uppercase opacity-60 mb-1">AI Chấm</span>
                                             <span className="text-3xl font-black">{ans?.ai_score ?? 0}</span>
                                             <span className="text-[10px] font-bold opacity-60 mt-1">/ 1.0</span>
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
                        <p className="font-black text-2xl">Chọn học sinh để xem chi tiết</p>
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
                   <input type="text" placeholder="Họ và tên của em" className="w-full p-6 rounded-[24px] bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold text-lg" value={studentName} onChange={e => setStudentName(e.target.value)} />
                   <input type="text" placeholder="Lớp" className="w-full p-6 rounded-[24px] bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold text-lg" value={className} onChange={e => setClassName(e.target.value)} />
                   <input type="text" placeholder="MÃ PHÒNG THI" className="w-full p-8 rounded-[24px] bg-slate-900 text-white text-center font-black text-3xl tracking-widest placeholder:text-slate-700 uppercase shadow-xl" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
                </div>
                <button onClick={async () => {
                   if(!studentName || !className || !examCodeInput) return alert("Em điền đủ thông tin nhé!");
                   setIsProcessing(true);
                   try {
                      const { data, error } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
                      if(error || !data) return alert("Không tìm thấy phòng thi này!");
                      if(!data.is_open) return alert("Phòng thi hiện đang đóng!");
                      setCurrentExam(data); setMode(AppMode.STUDENT_EXAM); setTimer(0);
                   } finally { setIsProcessing(false); }
                }} className="w-full bg-indigo-600 text-white py-7 rounded-[32px] font-black text-2xl hover:bg-indigo-700 shadow-2xl transition-all">BẮT ĐẦU THI</button>
             </div>
          </div>
        )}
        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-32">
             <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-xl sticky top-24 z-50 flex justify-between items-center border border-slate-100">
                <div className="flex items-center gap-4"><div className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black uppercase text-xs">Câu {Object.keys(studentAnswers).length}/{currentExam.questions.length}</div></div>
                <div className="text-2xl font-black text-indigo-600 tabular-nums bg-indigo-50 px-6 py-2 rounded-2xl"><Clock size={20} className="inline mr-2 mb-1"/> {Math.floor(timer / 60).toString().padStart(2, '0')}:{(timer % 60).toString().padStart(2, '0')}</div>
             </div>
             {currentExam.questions.map((q, idx) => (
                <div key={idx} className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 relative overflow-hidden group">
                   <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl text-[9px] font-black uppercase tracking-widest ${q.type === 'mcq' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>{q.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}</div>
                   <p className="text-xl font-bold text-slate-800 mb-8 leading-relaxed"><span className="text-indigo-600 mr-2">Câu {idx+1}:</span> {q.prompt}</p>
                   {q.type === 'mcq' ? (
                     <div className="grid grid-cols-1 gap-4">
                        {q.options?.map((opt, oIdx) => (
                          <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`p-6 rounded-2xl border-2 font-bold text-left transition-all flex items-center gap-4 ${studentAnswers[q.id] === oIdx ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'}`}>
                             <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-white text-indigo-600 shadow-sm'}`}>{String.fromCharCode(65+oIdx)}</span>
                             {opt}
                          </button>
                        ))}
                     </div>
                   ) : (
                     <textarea className="w-full p-8 rounded-[32px] bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-medium text-lg min-h-[250px] shadow-inner" placeholder="Em nhập câu trả lời tại đây nhé..." value={studentAnswers[q.id] || ''} onChange={(e) => setStudentAnswers({...studentAnswers, [q.id]: e.target.value})} />
                   )}
                </div>
             ))}
             <button onClick={handleStudentSubmit} className="w-full bg-emerald-500 text-white py-8 rounded-[40px] font-black text-3xl shadow-2xl hover:bg-emerald-600 transition-all">NỘP BÀI THI</button>
          </div>
        )}
        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
          <div className="max-w-md mx-auto py-20 text-center animate-fade-in">
             <div className="bg-white p-16 rounded-[72px] shadow-2xl border border-slate-50">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-10"><CheckCircle2 size={56}/></div>
                <h2 className="text-4xl font-black mb-3 text-slate-800">Hoàn thành!</h2>
                <div className="bg-slate-900 text-white p-12 rounded-[48px] mb-12 shadow-2xl">
                   <div className="text-[10px] font-black uppercase tracking-widest mb-4 text-slate-500">Điểm tổng quát</div>
                   <div className="text-7xl font-black">{currentSubmission.score.toFixed(1)}<span className="text-3xl text-slate-500 ml-1">/{currentSubmission.total}</span></div>
                   <p className="mt-4 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Đã bao gồm điểm chấm AI</p>
                </div>
                <button onClick={() => window.location.reload()} className="w-full py-4 text-slate-400 font-black hover:text-slate-900 transition-colors uppercase tracking-widest text-xs">Về trang chủ</button>
             </div>
          </div>
        )}
        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
             <div className="bg-white/90 backdrop-blur-md p-10 rounded-[40px] shadow-xl border border-emerald-100 sticky top-24 z-50 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-emerald-600">Kiểm tra và chọn đáp án đúng</h2>
                  <p className="text-slate-500 font-medium mt-2">Click vào lựa chọn đúng cho câu trắc nghiệm (sẽ hiện xanh).</p>
                </div>
                <button
                  onClick={async () => {
                    if (currentExam.questions.some(q => q.type === 'mcq' && q.correctAnswerIndex === null)) {
                      if (!confirm("Có câu trắc nghiệm chưa chọn đáp án đúng. Vẫn lưu đề?")) return;
                    }
                    setIsProcessing(true);
                    await supabase.from('exams').insert([currentExam]);
                    await fetchInitialData();
                    setMode(AppMode.TEACHER_DASHBOARD);
                    setIsProcessing(false);
                  }}
                  className="bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black text-xl shadow-lg hover:bg-indigo-700"
                >
                  LƯU & XUẤT BẢN
                </button>
             </div>
             {currentExam.questions.map((q, idx) => (
               <div key={idx} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
                  <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl text-[10px] font-black uppercase tracking-widest ${q.type === 'mcq' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                    {q.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}
                  </div>
                  <p className="font-bold text-xl mb-8 pr-12">Câu {idx + 1}: {q.prompt}</p>

                  {q.type === 'mcq' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options?.map((opt: string, oIdx: number) => (
                        <button
                          key={oIdx}
                          onClick={() => {
                            setCurrentExam({
                              ...currentExam,
                              questions: currentExam.questions.map((qq, i) =>
                                i === idx ? { ...qq, correctAnswerIndex: oIdx } : qq
                              )
                            });
                          }}
                          className={`p-6 rounded-2xl border-2 font-bold text-left transition-all ${
                            oIdx === q.correctAnswerIndex
                              ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-400 text-slate-700'
                          }`}
                        >
                          <span className="mr-3 text-lg">{String.fromCharCode(65 + oIdx)}.</span>
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 font-medium text-emerald-900">
                      <span className="text-[10px] font-black uppercase block mb-2 tracking-widest">Đáp án mẫu (dùng để AI chấm):</span>
                      <textarea
                        className="w-full p-4 bg-white rounded-xl border border-emerald-200 outline-none font-medium"
                        rows={4}
                        value={q.sampleAnswer || ''}
                        onChange={(e) => {
                          setCurrentExam({
                            ...currentExam,
                            questions: currentExam.questions.map((qq, i) =>
                              i === idx ? { ...qq, sampleAnswer: e.target.value } : qq
                            )
                          });
                        }}
                      />
                    </div>
                  )}
               </div>
             ))}
          </div>
        )}
      </main>
     
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default App;
