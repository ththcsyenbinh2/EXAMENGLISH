
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

  // Fix: Added isStudentMode to determine if the current view is for students
  const isStudentMode = mode === AppMode.STUDENT_ENTRY || mode === AppMode.STUDENT_EXAM || mode === AppMode.STUDENT_RESULT;

  // Fix: Defined handleAdminLogin to handle admin authentication logic
  const handleAdminLogin = () => {
    if (loginPasscode === savedPasscode || (!savedPasscode && loginPasscode === '1234')) {
      localStorage.setItem('ST_IS_ADMIN', 'true');
      setMode(AppMode.TEACHER_DASHBOARD);
    } else {
      alert("Sai mật mã!");
    }
  };

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
    } catch (e) { console.error("Fetch error:", e); }
  };

  const deleteExam = async (examId: string) => {
    if(!confirm("Xác nhận xóa vĩnh viễn?")) return;
    setIsProcessing(true);
    setLoadingStep("Đang xóa dữ liệu...");
    try {
      // Ép xóa sạch submissions trước
      await supabase.from('submissions').delete().eq('exam_id', examId);
      // Xóa exam
      const { error } = await supabase.from('exams').delete().eq('id', examId);
      
      if (error) throw error;
      
      setExams(prev => prev.filter(e => e.id !== examId));
      alert("Đã xóa thành công!");
      fetchInitialData();
    } catch (e: any) {
      alert("Lỗi xóa: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setLoadingStep('AI đang xử lý file...');
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

  const handleStudentSubmit = async () => {
    if(!currentExam) return;
    setIsProcessing(true);
    setLoadingStep('Đang nộp bài...');
    try {
      let finalScore = 0;
      const finalAnswers: Record<string, any> = {};
      
      for (const q of currentExam.questions) {
        const ans = studentAnswers[q.id];
        if (q.type === 'mcq') {
          const isCorrect = Number(ans) === Number(q.correctAnswerIndex);
          if (isCorrect) finalScore += 1;
          finalAnswers[q.id] = { value: ans, type: 'mcq' };
        } else {
          const aiScore = ans ? await gradeEssayWithAI(q.prompt, ans, q.sampleAnswer || "") : 0;
          finalScore += aiScore;
          finalAnswers[q.id] = { value: ans || "", type: 'essay', ai_score: aiScore };
        }
      }

      const payload = { 
        id: crypto.randomUUID(), 
        exam_id: currentExam.id, 
        student_name: studentName, 
        class_name: className, 
        answers: finalAnswers, 
        score: finalScore, 
        total: currentExam.questions.length, 
        time_spent: timer, 
        submitted_at: new Date().toISOString() 
      };

      await supabase.from('submissions').insert([payload]);
      setCurrentSubmission(payload as any);
      setMode(AppMode.STUDENT_RESULT);
    } catch (e: any) { alert(e.message); }
    finally { setIsProcessing(false); }
  };

  if (showSetup) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white p-10 rounded-[40px] shadow-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-8">
             <h2 className="text-2xl font-black">Cài đặt Cloud</h2>
             <button onClick={() => setShowSetup(false)}><XCircle/></button>
          </div>
          <div className="space-y-6 mb-10">
            <input type="text" placeholder="Supabase URL" className="w-full p-4 rounded-xl bg-slate-50 border-2" value={inputUrl} onChange={e => setInputUrl(e.target.value)} />
            <textarea placeholder="Anon Key" className="w-full p-4 rounded-xl bg-slate-50 border-2 h-24" value={inputKey} onChange={e => setInputKey(e.target.value)} />
            <input type="password" placeholder="Mật mã Admin" className="w-full p-4 rounded-xl bg-indigo-50 border-2 border-transparent" value={inputPasscode} onChange={e => setInputPasscode(e.target.value)} />
          </div>
          <button onClick={() => { 
            localStorage.setItem('ST_SUPABASE_URL', inputUrl.trim()); 
            localStorage.setItem('ST_SUPABASE_ANON_KEY', inputKey.trim()); 
            if (inputPasscode) localStorage.setItem('ST_ADMIN_PASSCODE', inputPasscode.trim());
            window.location.reload(); 
          }} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black">LƯU CẤU HÌNH</button>
        </div>
      </div>
    );
  }

  if (mode === AppMode.ADMIN_LOGIN) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-[56px] shadow-2xl text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-[28px] flex items-center justify-center text-white mx-auto mb-8"><Lock size={40}/></div>
          <h2 className="text-3xl font-black text-slate-800 mb-2">Đăng nhập Giáo viên</h2>
          <input type="password" placeholder="••••••" className="w-full p-6 rounded-3xl bg-slate-100 border-2 text-center font-black text-3xl mb-8" value={loginPasscode} onChange={e => setLoginPasscode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} />
          <button onClick={handleAdminLogin} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black">VÀO QUẢN TRỊ</button>
          <button onClick={() => window.location.hash = '#hocsinh'} className="mt-8 text-indigo-600 font-bold">Tôi là học sinh</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900">
      <header className="bg-white/90 border-b py-4 px-6 sticky top-0 z-[100] backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg"><GraduationCap size={24}/></div>
            <span className="text-xl font-black">Edu<span className="text-indigo-600">Cloud</span></span>
          </div>
          {!isStudentMode && (
            <div className="flex items-center gap-3">
               <button onClick={() => setShowSetup(true)} className="p-2.5 hover:bg-slate-100 rounded-xl"><Settings/></button>
               <button onClick={() => { localStorage.removeItem('ST_IS_ADMIN'); window.location.reload(); }} className="p-2.5 text-red-400"><XCircle/></button>
            </div>
          )}
        </div>
      </header>

      <main className="py-8 px-6 max-w-7xl mx-auto">
        {isProcessing && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center">
            <div className="bg-white p-12 rounded-[48px] shadow-2xl text-center">
              <Loader2 size={48} className="text-indigo-600 animate-spin mx-auto mb-6"/>
              <h2 className="text-2xl font-black">{loadingStep}</h2>
            </div>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && (
          <div className="space-y-10 animate-fade-in">
             <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-12 rounded-[48px] text-white flex flex-col md:flex-row justify-between items-center gap-8">
                <h1 className="text-4xl font-black">Quản lý Đề thi 📚</h1>
                <label className="bg-white text-indigo-600 px-10 py-5 rounded-[28px] font-black cursor-pointer shadow-xl">
                  + TẢI ĐỀ (.docx)
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                </label>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col min-h-[300px]">
                    <span className="text-[10px] font-black text-slate-400 mb-4">MÃ: {exam.exam_code}</span>
                    <h3 className="text-xl font-black mb-6 line-clamp-2">{exam.title}</h3>
                    <div className="mt-auto flex gap-2">
                       <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs">KẾT QUẢ</button>
                       <button onClick={() => deleteExam(exam.id)} className="p-4 bg-red-50 text-red-400 rounded-2xl"><Trash2/></button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {mode === AppMode.VIEW_SUBMISSIONS && currentExam && (
          <div className="max-w-6xl mx-auto space-y-8 pb-20">
             <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="p-4 bg-white rounded-2xl shadow-sm"><ArrowLeft/></button>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4 max-h-[75vh] overflow-y-auto pr-2">
                   {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                      <div key={s.id} onClick={() => setSelectedSubmission(s)} className={`p-6 rounded-3xl border-2 transition-all cursor-pointer ${selectedSubmission?.id === s.id ? 'bg-indigo-600 text-white' : 'bg-white'}`}>
                         <div className="font-black">{s.student_name}</div>
                         <div className="text-xs opacity-60">Điểm: {Number(s.score).toFixed(1)}/{s.total}</div>
                      </div>
                   ))}
                </div>
                
                <div className="lg:col-span-2 bg-white rounded-[48px] shadow-2xl p-10 overflow-y-auto max-h-[75vh]">
                   {selectedSubmission ? (
                     <div className="space-y-12">
                        <div className="border-b pb-8">
                           <h2 className="text-4xl font-black">{selectedSubmission.student_name}</h2>
                           <div className="mt-4 bg-slate-900 text-white px-8 py-4 rounded-2xl inline-block">
                              <span className="text-4xl font-black">{Number(selectedSubmission.score).toFixed(1)}</span>/ {selectedSubmission.total}
                           </div>
                        </div>
                        <div className="space-y-10">
                           {currentExam.questions.map((q, idx) => {
                             const ans = selectedSubmission.answers[q.id];
                             const studentVal = ans?.value;
                             const correctIdx = q.correctAnswerIndex;
                             const isCorrect = q.type === 'mcq' && Number(studentVal) === Number(correctIdx);
                             
                             return (
                               <div key={idx} className={`p-8 rounded-[40px] border-2 transition-all ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-50'}`}>
                                  <p className="font-black text-xl mb-6">Câu {idx+1}: {q.prompt}</p>
                                  {q.type === 'mcq' ? (
                                    <div className="space-y-4">
                                       {/* Khối hiển thị đáp án học sinh */}
                                       <div className={`p-6 rounded-3xl border-2 font-bold flex items-center gap-4 ${isCorrect ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-red-500 border-red-600 text-white'}`}>
                                          <div className="w-12 h-12 bg-white text-slate-900 rounded-xl flex items-center justify-center text-xl shadow-md">
                                             {studentVal !== undefined ? String.fromCharCode(65 + Number(studentVal)) : '?'}
                                          </div>
                                          <div>
                                             <div className="text-[10px] uppercase opacity-70">Học sinh đã chọn:</div>
                                             <div className="text-lg">{studentVal !== undefined ? q.options?.[Number(studentVal)] : '(Để trống)'}</div>
                                          </div>
                                       </div>
                                       {/* Nếu sai mới hiện thêm đáp án đúng */}
                                       {!isCorrect && (
                                         <div className="p-6 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-3xl font-bold flex items-center gap-4">
                                            <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center text-xl shadow-md">
                                               {String.fromCharCode(65 + Number(correctIdx))}
                                            </div>
                                            <div>
                                               <div className="text-[10px] uppercase opacity-70">Đáp án chính xác:</div>
                                               <div className="text-lg">{q.options?.[Number(correctIdx)]}</div>
                                            </div>
                                         </div>
                                       )}
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                       <div className="bg-white p-6 rounded-2xl border italic">{ans?.value || '(Trống)'}</div>
                                       <div className="bg-indigo-600 text-white p-4 rounded-xl text-center font-black">AI Chấm: {ans?.ai_score}</div>
                                    </div>
                                  )}
                               </div>
                             );
                           })}
                        </div>
                     </div>
                   ) : <p className="text-center opacity-30 py-20">Chọn một bài thi để xem chi tiết</p>}
                </div>
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_ENTRY && (
          <div className="max-w-md mx-auto py-20 text-center">
             <div className="bg-white p-12 rounded-[64px] shadow-2xl border">
                <h2 className="text-4xl font-black mb-10">Vào Thi Online</h2>
                <div className="space-y-4 mb-10">
                   <input type="text" placeholder="Họ tên" className="w-full p-6 rounded-[24px] bg-slate-50 border-2" value={studentName} onChange={e => setStudentName(e.target.value)} />
                   <input type="text" placeholder="Lớp" className="w-full p-6 rounded-[24px] bg-slate-50 border-2" value={className} onChange={e => setClassName(e.target.value)} />
                   <input type="text" placeholder="MÃ PHÒNG" className="w-full p-8 rounded-[24px] bg-slate-900 text-white text-center font-black text-3xl uppercase" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
                </div>
                <button onClick={async () => {
                   setIsProcessing(true);
                   const { data } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
                   if(!data) alert("Mã sai!");
                   else { setCurrentExam(data); setMode(AppMode.STUDENT_EXAM); setTimer(0); }
                   setIsProcessing(false);
                }} className="w-full bg-indigo-600 text-white py-7 rounded-[32px] font-black text-2xl shadow-xl">BẮT ĐẦU</button>
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto space-y-8 pb-32">
             <div className="bg-white/90 p-6 rounded-3xl shadow-xl sticky top-24 z-50 flex justify-between font-black">
                <div className="text-indigo-600">PHÒNG: {currentExam.exam_code}</div>
                <div className="tabular-nums"><Clock size={20} className="inline mr-2"/> {Math.floor(timer/60)}:{timer%60}</div>
             </div>
             {currentExam.questions.map((q, idx) => (
                <div key={idx} className="bg-white p-10 rounded-[40px] shadow-sm border">
                   <p className="text-xl font-bold mb-8">Câu {idx+1}: {q.prompt}</p>
                   {q.type === 'mcq' ? (
                     <div className="space-y-4">
                        {q.options?.map((opt, oIdx) => (
                          <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`w-full p-6 rounded-2xl border-2 font-bold text-left flex items-center gap-4 ${studentAnswers[q.id] === oIdx ? 'bg-indigo-600 text-white' : 'bg-slate-50'}`}>
                             <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">{String.fromCharCode(65+oIdx)}</span>
                             {opt}
                          </button>
                        ))}
                     </div>
                   ) : <textarea className="w-full p-6 rounded-3xl bg-slate-50 min-h-[150px]" value={studentAnswers[q.id]||''} onChange={e=>setStudentAnswers({...studentAnswers,[q.id]:e.target.value})} />}
                </div>
             ))}
             <button onClick={handleStudentSubmit} className="w-full bg-emerald-500 text-white py-8 rounded-[40px] font-black text-3xl shadow-2xl">NỘP BÀI</button>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
          <div className="max-w-md mx-auto py-20 text-center">
             <div className="bg-white p-16 rounded-[72px] shadow-2xl border">
                <CheckCircle2 size={80} className="text-emerald-500 mx-auto mb-10"/>
                <h2 className="text-4xl font-black mb-10 text-emerald-600">Nộp bài xong!</h2>
                <div className="bg-slate-900 text-white p-12 rounded-[48px] shadow-2xl">
                   <div className="text-7xl font-black">{Number(currentSubmission.score).toFixed(1)}<span className="text-2xl opacity-40">/{currentSubmission.total}</span></div>
                   <div className="text-xs uppercase tracking-widest mt-4 opacity-50">Kết quả đã được gửi tới giáo viên</div>
                </div>
                <button onClick={() => window.location.reload()} className="mt-12 font-black text-slate-400">Về trang chủ</button>
             </div>
          </div>
        )}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
             <div className="bg-white p-10 rounded-[40px] shadow-xl border-2 border-emerald-500 flex justify-between items-center">
                <h2 className="text-2xl font-black text-emerald-600">AI đã hoàn tất đề thi!</h2>
                <button onClick={async () => { 
                  setIsProcessing(true);
                  await supabase.from('exams').insert([currentExam]); 
                  fetchInitialData(); 
                  setMode(AppMode.TEACHER_DASHBOARD);
                  setIsProcessing(false);
                }} className="bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black shadow-lg">LƯU & XUẤT BẢN</button>
             </div>
             {currentExam.questions.map((q, idx) => (
               <div key={idx} className="bg-white p-10 rounded-[40px] border shadow-sm">
                  <p className="font-bold text-xl mb-6">Câu {idx+1}: {q.prompt}</p>
                  {q.type === 'mcq' ? (
                    <div className="grid grid-cols-2 gap-4">
                       {q.options?.map((opt, oIdx) => (
                         <div key={oIdx} className={`p-4 rounded-xl border-2 ${oIdx === Number(q.correctAnswerIndex) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50'}`}>
                           {String.fromCharCode(65+oIdx)}. {opt}
                         </div>
                       ))}
                    </div>
                  ) : <div className="p-4 bg-emerald-50 rounded-xl">{q.sampleAnswer}</div>}
               </div>
             ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
