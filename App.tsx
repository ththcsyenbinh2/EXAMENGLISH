
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
    const { data: exData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
    setExams(exData || []);
    const { data: subData } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
    setSubmissions(subData || []);
  };

  const handleAdminLogin = () => {
    if (loginPasscode === savedPasscode || (!savedPasscode && loginPasscode === '1234')) {
      localStorage.setItem('ST_IS_ADMIN', 'true');
      setMode(AppMode.TEACHER_DASHBOARD);
    } else alert("Sai mật mã!");
  };

  const deleteExam = async (examId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn đề thi này và tất cả kết quả liên quan không?")) return;
    
    setIsProcessing(true);
    setLoadingStep("Đang xóa dữ liệu trên Cloud...");
    
    try {
      // BƯỚC 1: Xóa bài nộp trước (Bắt buộc để không vi phạm ràng buộc Foreign Key)
      const { error: subError } = await supabase.from('submissions').delete().eq('exam_id', examId);
      if (subError) throw subError;

      // BƯỚC 2: Xóa đề thi
      const { error: exError } = await supabase.from('exams').delete().eq('id', examId);
      if (exError) throw exError;

      // BƯỚC 3: Cập nhật lại danh sách ngay lập tức
      await fetchInitialData();
      alert("Đã xóa đề thi thành công!");
    } catch (e: any) {
      alert("Lỗi khi xóa: " + e.message + "\n\nGiải pháp: Hãy kiểm tra quyền 'DELETE' trong RLS của Supabase.");
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
    setLoadingStep('Hệ thống đang chấm bài...');
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
    const currentCfg = getSupabaseConfig();
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white p-10 rounded-[40px] shadow-2xl border">
          <h2 className="text-2xl font-black mb-8">Cấu hình Cloud</h2>
          <div className="space-y-6 mb-8">
            <input type="text" placeholder="Supabase URL" className="w-full p-4 rounded-xl bg-slate-50 border-2" value={inputUrl || currentCfg.url} onChange={e => setInputUrl(e.target.value)} />
            <textarea placeholder="Anon Key" className="w-full p-4 rounded-xl bg-slate-50 border-2 h-24" value={inputKey || currentCfg.key} onChange={e => setInputKey(e.target.value)} />
            <input type="password" placeholder="Mã Admin (Mặc định 1234)" className="w-full p-4 rounded-xl bg-indigo-50" value={inputPasscode} onChange={e => setInputPasscode(e.target.value)} />
          </div>
          <button onClick={() => { 
            localStorage.setItem('ST_SUPABASE_URL', inputUrl.trim()); 
            localStorage.setItem('ST_SUPABASE_ANON_KEY', inputKey.trim()); 
            if (inputPasscode) localStorage.setItem('ST_ADMIN_PASSCODE', inputPasscode.trim());
            window.location.reload(); 
          }} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg">LƯU CẤU HÌNH</button>
        </div>
      </div>
    );
  }

  if (mode === AppMode.ADMIN_LOGIN) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white p-12 rounded-[56px] shadow-2xl">
          <div className="w-20 h-20 bg-indigo-600 rounded-[24px] flex items-center justify-center text-white mx-auto mb-8 shadow-xl"><Lock size={40}/></div>
          <h2 className="text-3xl font-black mb-10 text-slate-800">Khu vực Giáo viên</h2>
          <input type="password" placeholder="••••••" className="w-full p-6 rounded-3xl bg-slate-100 border-2 text-center font-black text-4xl mb-8 outline-none focus:border-indigo-600" value={loginPasscode} onChange={e => setLoginPasscode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} />
          <button onClick={handleAdminLogin} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black text-xl">ĐĂNG NHẬP</button>
          <button onClick={() => window.location.hash = '#hocsinh'} className="mt-8 text-indigo-600 font-bold block mx-auto">Tôi là học sinh</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900 font-['Inter']">
      <header className="bg-white/90 border-b py-4 px-6 sticky top-0 z-[100] backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg"><GraduationCap size={24}/></div>
            <span className="text-xl font-black">Edu<span className="text-indigo-600">Cloud</span></span>
          </div>
          {!isStudentMode && (
            <div className="flex items-center gap-3">
               <button onClick={() => setShowSetup(true)} className="p-2.5 hover:bg-slate-100 rounded-xl"><Settings size={20}/></button>
               <button onClick={() => { localStorage.removeItem('ST_IS_ADMIN'); window.location.reload(); }} className="p-2.5 text-red-400"><XCircle size={20}/></button>
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
             <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-12 rounded-[48px] text-white flex flex-col md:flex-row justify-between items-center shadow-2xl">
                <h1 className="text-4xl font-black">Quản lý Đề thi 📚</h1>
                <label className="bg-white text-indigo-600 px-10 py-5 rounded-[28px] font-black cursor-pointer shadow-xl hover:scale-105 transition-all">
                  + TẢI ĐỀ (.docx)
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                </label>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col min-h-[300px] hover:shadow-xl transition-all">
                    <span className="text-[10px] font-black text-slate-400 mb-4 tracking-widest">MÃ PHÒNG: {exam.exam_code}</span>
                    <h3 className="text-xl font-black mb-6 line-clamp-2 h-14">{exam.title}</h3>
                    <div className="mt-auto flex gap-2">
                       <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs shadow-md">XEM KẾT QUẢ</button>
                       <button onClick={() => deleteExam(exam.id)} className="p-4 bg-red-50 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18}/></button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {mode === AppMode.VIEW_SUBMISSIONS && currentExam && (
          <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-fade-in">
             <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="p-4 bg-white rounded-2xl shadow-sm border"><ArrowLeft size={24}/></button>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4 max-h-[75vh] overflow-y-auto pr-2">
                   {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                      <div key={s.id} onClick={() => setSelectedSubmission(s)} className={`p-6 rounded-3xl border-2 transition-all cursor-pointer ${selectedSubmission?.id === s.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl' : 'bg-white border-slate-50 hover:border-indigo-100'}`}>
                         <div className="font-black text-lg">{s.student_name}</div>
                         <div className="text-xs opacity-60">Điểm: {Number(s.score).toFixed(1)}/{s.total}</div>
                      </div>
                   ))}
                </div>
                
                <div className="lg:col-span-2 bg-white rounded-[48px] shadow-2xl p-10 overflow-y-auto max-h-[75vh] border">
                   {selectedSubmission ? (
                     <div className="space-y-12 animate-fade-in">
                        <div className="border-b pb-8 flex justify-between items-end">
                           <div>
                              <h2 className="text-4xl font-black text-slate-800">{selectedSubmission.student_name}</h2>
                              <p className="text-slate-400 font-bold mt-2">Lớp: {selectedSubmission.class_name}</p>
                           </div>
                           <div className="bg-slate-900 text-white px-10 py-6 rounded-[32px] text-center shadow-xl">
                              <div className="text-4xl font-black">{Number(selectedSubmission.score).toFixed(1)}</div>
                              <div className="text-[10px] font-black text-slate-500 uppercase mt-1">Tổng điểm</div>
                           </div>
                        </div>
                        <div className="space-y-10">
                           {currentExam.questions.map((q, idx) => {
                             const ans = selectedSubmission.answers[q.id];
                             const studentVal = ans?.value;
                             const correctIdx = q.correctAnswerIndex;
                             const isCorrect = q.type === 'mcq' && Number(studentVal) === Number(correctIdx);
                             
                             return (
                               <div key={idx} className={`p-8 rounded-[40px] border-2 transition-all ${isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                                  <div className="flex justify-between items-start mb-6">
                                     <p className="font-black text-xl text-slate-800 pr-10">Câu {idx+1}: {q.prompt}</p>
                                     <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase ${q.type === 'mcq' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {q.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}
                                     </span>
                                  </div>
                                  
                                  {q.type === 'mcq' ? (
                                    <div className="space-y-4">
                                       {/* Khối hiển thị đáp án: Xanh nếu đúng hoàn toàn, Đỏ nếu học sinh sai */}
                                       <div className={`p-6 rounded-3xl border-2 font-bold flex items-center gap-4 ${isCorrect ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg' : 'bg-red-500 border-red-600 text-white shadow-lg'}`}>
                                          <div className={`w-12 h-12 bg-white ${isCorrect ? 'text-emerald-600' : 'text-red-600'} rounded-xl flex items-center justify-center text-xl shadow-md font-black`}>
                                             {studentVal !== undefined ? String.fromCharCode(65 + Number(studentVal)) : '?'}
                                          </div>
                                          <div>
                                             <div className="text-[10px] uppercase opacity-70">Học sinh đã chọn:</div>
                                             <div className="text-lg">{studentVal !== undefined ? q.options?.[Number(studentVal)] : '(Để trống)'}</div>
                                          </div>
                                       </div>
                                       
                                       {/* Chỉ hiện khối này khi học sinh chọn SAI */}
                                       {!isCorrect && (
                                         <div className="p-6 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-3xl font-bold flex items-center gap-4">
                                            <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center text-xl shadow-md font-black">
                                               {String.fromCharCode(65 + Number(correctIdx))}
                                            </div>
                                            <div>
                                               <div className="text-[10px] uppercase opacity-70">Đáp án chính xác là:</div>
                                               <div className="text-lg">{q.options?.[Number(correctIdx)]}</div>
                                            </div>
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
                                             <span className="text-[10px] font-black uppercase opacity-60 mb-1">AI Chấm</span>
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
                        <p className="font-black text-2xl">Chọn một bài làm để xem</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_ENTRY && (
          <div className="max-w-md mx-auto py-20 text-center animate-fade-in">
             <div className="bg-white p-12 rounded-[64px] shadow-2xl border">
                <div className="w-24 h-24 bg-indigo-600 rounded-[32px] flex items-center justify-center text-white mx-auto mb-10 shadow-2xl rotate-3"><FileText size={48}/></div>
                <h2 className="text-4xl font-black mb-10 text-slate-800">Vào Phòng Thi</h2>
                <div className="space-y-4 mb-10 text-left">
                   <input type="text" placeholder="Họ và tên học sinh" className="w-full p-6 rounded-[24px] bg-slate-50 border-2 outline-none focus:border-indigo-600 font-bold" value={studentName} onChange={e => setStudentName(e.target.value)} />
                   <input type="text" placeholder="Lớp" className="w-full p-6 rounded-[24px] bg-slate-50 border-2 outline-none focus:border-indigo-600 font-bold" value={className} onChange={e => setClassName(e.target.value)} />
                   <input type="text" placeholder="MÃ PHÒNG" className="w-full p-8 rounded-[24px] bg-slate-900 text-white text-center font-black text-3xl uppercase tracking-widest shadow-xl" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
                </div>
                <button onClick={async () => {
                   if(!studentName || !examCodeInput) return alert("Điền đủ thông tin em nhé!");
                   setIsProcessing(true);
                   try {
                     const { data } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
                     if(!data) alert("Mã phòng không đúng!");
                     else { setCurrentExam(data); setMode(AppMode.STUDENT_EXAM); setTimer(0); }
                   } finally { setIsProcessing(false); }
                }} className="w-full bg-indigo-600 text-white py-7 rounded-[32px] font-black text-2xl shadow-xl hover:bg-indigo-700">BẮT ĐẦU THI</button>
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto space-y-8 pb-32 animate-fade-in">
             <div className="bg-white/90 p-6 rounded-3xl shadow-xl sticky top-24 z-50 flex justify-between items-center border">
                <div className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-xs">CÂU {Object.keys(studentAnswers).length}/{currentExam.questions.length}</div>
                <div className="text-2xl font-black text-indigo-600 bg-indigo-50 px-6 py-2 rounded-2xl"><Clock size={20} className="inline mr-2"/> {Math.floor(timer/60)}:{timer%60}</div>
             </div>
             {currentExam.questions.map((q, idx) => (
                <div key={idx} className="bg-white p-10 rounded-[40px] shadow-sm border relative">
                   <p className="text-xl font-bold mb-8 text-slate-800"><span className="text-indigo-600 mr-2">Câu {idx+1}:</span> {q.prompt}</p>
                   {q.type === 'mcq' ? (
                     <div className="space-y-4">
                        {q.options?.map((opt, oIdx) => (
                          <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`w-full p-6 rounded-2xl border-2 font-bold text-left flex items-center gap-4 transition-all ${studentAnswers[q.id] === oIdx ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}>
                             <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-white text-indigo-600 shadow-sm'}`}>{String.fromCharCode(65+oIdx)}</span>
                             {opt}
                          </button>
                        ))}
                     </div>
                   ) : <textarea className="w-full p-8 rounded-[32px] bg-slate-50 border-2 border-transparent outline-none focus:border-indigo-600 min-h-[200px]" placeholder="Nhập câu trả lời của em..." value={studentAnswers[q.id]||''} onChange={e=>setStudentAnswers({...studentAnswers,[q.id]:e.target.value})} />}
                </div>
             ))}
             <button onClick={handleStudentSubmit} className="w-full bg-emerald-500 text-white py-8 rounded-[40px] font-black text-3xl shadow-2xl hover:bg-emerald-600">NỘP BÀI THI</button>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
          <div className="max-w-md mx-auto py-20 text-center animate-fade-in">
             <div className="bg-white p-16 rounded-[72px] shadow-2xl border">
                <CheckCircle2 size={80} className="text-emerald-500 mx-auto mb-10"/>
                <h2 className="text-4xl font-black mb-10 text-slate-800">Hoàn tất!</h2>
                <div className="bg-slate-900 text-white p-12 rounded-[48px] shadow-2xl">
                   <div className="text-7xl font-black">{Number(currentSubmission.score).toFixed(1)}<span className="text-2xl opacity-40">/{currentSubmission.total}</span></div>
                   <div className="text-[10px] font-black uppercase mt-4 text-emerald-400 tracking-widest">Đã lưu trên Cloud</div>
                </div>
                <button onClick={() => window.location.reload()} className="mt-12 font-black text-slate-400 hover:text-slate-900 transition-colors uppercase text-xs tracking-widest">Quay lại trang chủ</button>
             </div>
          </div>
        )}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-fade-in">
             <div className="bg-white p-10 rounded-[40px] shadow-xl border-2 border-emerald-500 flex justify-between items-center sticky top-24 z-50">
                <div><h2 className="text-2xl font-black text-emerald-600">AI đã bóc tách đề xong!</h2><p className="text-slate-500 font-medium italic">Vui lòng kiểm tra đáp án đúng (ô màu xanh).</p></div>
                <button onClick={async () => { 
                  setIsProcessing(true);
                  await supabase.from('exams').insert([currentExam]); 
                  await fetchInitialData(); 
                  setMode(AppMode.TEACHER_DASHBOARD);
                  setIsProcessing(false);
                }} className="bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black shadow-lg hover:bg-indigo-700 transition-all">LƯU & XUẤT BẢN</button>
             </div>
             {currentExam.questions.map((q, idx) => (
               <div key={idx} className="bg-white p-10 rounded-[40px] border shadow-sm relative">
                  <p className="font-bold text-xl mb-8 text-slate-800">Câu {idx+1}: {q.prompt}</p>
                  {q.type === 'mcq' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {q.options?.map((opt, oIdx) => (
                         <div key={oIdx} className={`p-5 rounded-2xl border-2 font-bold ${oIdx === Number(q.correctAnswerIndex) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                           <span className="mr-3 opacity-40">{String.fromCharCode(65+oIdx)}.</span> {opt}
                         </div>
                       ))}
                    </div>
                  ) : <div className="p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-sm font-medium">{q.sampleAnswer}</div>}
               </div>
             ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
