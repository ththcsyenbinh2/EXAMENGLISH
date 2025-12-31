
import React, { useState, useEffect } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText, gradeEssayWithAI } from './services/geminiService';
import { supabase, isSupabaseConfigured, getSupabaseConfig } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, Trash2, Trophy, Clock, Users, ArrowLeft, 
  Database, Settings, RefreshCw, CheckCircle2, CloudLightning, 
  ClipboardList, Info, Save, Activity, Eye, FileText, ChevronRight, XCircle, Loader2
} from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TEACHER_DASHBOARD);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  
  const [showSetup, setShowSetup] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [inputKey, setInputKey] = useState('');

  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [examCodeInput, setExamCodeInput] = useState('');
  const [studentAnswers, setStudentAnswers] = useState<Record<string, any>>({});
  const [currentSubmission, setCurrentSubmission] = useState<StudentSubmission | null>(null);
  const [timer, setTimer] = useState(0);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) return;
    fetchInitialData();
    const channel = supabase.channel('db-changes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions' }, () => fetchInitialData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [configured]);

  useEffect(() => {
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
    if (mode === AppMode.STUDENT_EXAM) interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [mode]);

  const fetchInitialData = async () => {
    if (!isSupabaseConfigured()) return;
    setIsDbLoading(true);
    const { data: exData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
    setExams(exData || []);
    const { data: subData } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
    setSubmissions(subData || []);
    setIsDbLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setLoadingStep('AI đang phân tích & giải đề...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      const extracted = await extractQuestionsFromText(result.value);
      setCurrentExam({ id: crypto.randomUUID(), exam_code: Math.random().toString(36).substring(2, 8).toUpperCase(), title: extracted.title, questions: extracted.questions, is_open: true, created_at: new Date().toISOString() });
      setMode(AppMode.EXAM_SETUP);
    } catch (error: any) { alert(error.message); }
    finally { setIsProcessing(false); }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleStudentSubmit = async () => {
    if(!currentExam) return;
    if(!confirm("Xác nhận nộp bài?")) return;

    setIsProcessing(true);
    setLoadingStep('AI đang chấm điểm tự luận...');

    try {
      let mcqScore = 0;
      let essayScore = 0;
      
      // Chấm điểm từng câu
      for (const q of currentExam.questions) {
        const studentAns = studentAnswers[q.id];
        if (q.type === 'mcq') {
          if (studentAns === q.correctAnswerIndex) mcqScore++;
        } else if (q.type === 'essay' && studentAns) {
          // Sử dụng AI để chấm câu tự luận
          const score = await gradeEssayWithAI(q.prompt, studentAns, q.sampleAnswer || "");
          essayScore += score;
        }
      }

      const totalPossibleScore = currentExam.questions.length;
      const finalScore = mcqScore + essayScore;

      const payload = { 
        id: crypto.randomUUID(), 
        exam_id: currentExam.id, 
        student_name: studentName, 
        class_name: className, 
        answers: studentAnswers, 
        score: finalScore, 
        total: totalPossibleScore, 
        time_spent: timer, 
        submitted_at: new Date().toISOString() 
      };

      const { error } = await supabase.from('submissions').insert([payload]);
      if (error) throw error;

      setCurrentSubmission(payload as any);
      setMode(AppMode.STUDENT_RESULT);
    } catch (error: any) {
      alert("Lỗi khi nộp bài: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (showSetup) {
    const currentCfg = getSupabaseConfig();
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white p-10 rounded-[40px] shadow-2xl border border-slate-200">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg"><Database size={28}/></div>
            <h2 className="text-2xl font-black text-slate-800">Cấu hình Cloud</h2>
          </div>
          <div className="space-y-6 mb-10">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Supabase URL</label>
              <input type="text" className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold" value={inputUrl || currentCfg.url} onChange={e => setInputUrl(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Anon Key</label>
              <textarea className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold h-24" value={inputKey || currentCfg.key} onChange={e => setInputKey(e.target.value)} />
            </div>
          </div>
          <button onClick={() => { localStorage.setItem('ST_SUPABASE_URL', inputUrl.trim()); localStorage.setItem('ST_SUPABASE_ANON_KEY', inputKey.trim()); window.location.reload(); }} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-700 transition-all">LƯU CẤU HÌNH</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900">
      <header className="bg-white/80 border-b border-slate-100 py-4 px-6 sticky top-0 z-[100] backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.hash = ''}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg"><GraduationCap size={24}/></div>
            <span className="text-xl font-black text-slate-900">Edu<span className="text-indigo-600">Cloud</span></span>
          </div>
          <div className="flex items-center gap-3">
             {configured && <button onClick={() => { const {url, key} = getSupabaseConfig(); navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?s_url=${encodeURIComponent(url)}&s_key=${encodeURIComponent(key)}`); alert("Đã copy link quản trị!"); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black">LINK QUẢN TRỊ</button>}
             <button onClick={() => setShowSetup(true)} className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400"><Settings size={20}/></button>
          </div>
        </div>
      </header>

      <main className="py-8 px-6 max-w-7xl mx-auto">
        {isProcessing && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center">
            <div className="bg-white p-12 rounded-[48px] shadow-2xl text-center max-w-sm">
              <Loader2 size={48} className="text-indigo-600 animate-spin mx-auto mb-6"/>
              <h2 className="text-2xl font-black text-slate-800 mb-2">{loadingStep}</h2>
              <p className="text-slate-400 font-medium text-sm">Vui lòng đợi trong giây lát, AI đang xử lý dữ liệu phức tạp...</p>
            </div>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && (
          <div className="space-y-10 animate-fade-in">
             <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-12 rounded-[48px] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                <div className="relative z-10">
                  <h1 className="text-4xl font-black mb-4 tracking-tight">Hệ thống Đề thi AI Hybrid 📚</h1>
                  <p className="text-indigo-100 text-lg opacity-80">Tự động bóc tách đề & Chấm điểm tự luận bằng AI thông minh.</p>
                </div>
                <label className="relative z-10 bg-white text-indigo-600 px-10 py-5 rounded-[28px] font-black text-xl shadow-xl hover:scale-105 transition-all cursor-pointer flex items-center gap-3">
                  <Plus size={24}/> TẢI ĐỀ WORD (.docx)
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                </label>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col min-h-[300px] hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">MÃ: {exam.exam_code}</span>
                      <button 
                        onClick={async () => {
                          await supabase.from('exams').update({ is_open: !exam.is_open }).eq('id', exam.id);
                          fetchInitialData();
                        }}
                        className={`px-3 py-1 rounded-full text-[9px] font-black transition-all ${exam.is_open ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-400'}`}>
                        {exam.is_open ? 'PHÒNG MỞ' : 'PHÒNG ĐÓNG'}
                      </button>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-6 line-clamp-2 h-14 leading-tight group-hover:text-indigo-600 transition-colors">{exam.title}</h3>
                    <div className="bg-slate-50 p-4 rounded-2xl mb-6 flex justify-between items-center">
                       <div className="flex items-center gap-2">
                          <Users size={16} className="text-slate-400"/>
                          <span className="text-sm font-bold text-slate-600">{submissions.filter(s => s.exam_id === exam.id).length} bài nộp</span>
                       </div>
                       <div className="text-[10px] font-black text-slate-400 uppercase">{exam.questions.length} câu hỏi</div>
                    </div>
                    <div className="flex gap-2 mt-auto">
                       <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all">XEM KẾT QUẢ</button>
                       <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#hocsinh`); alert("Đã copy link học sinh!"); }} className="p-4 bg-white border border-slate-100 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors"><Share2 size={18}/></button>
                       <button onClick={async () => { if(confirm("Xóa đề này vĩnh viễn?")) { await supabase.from('exams').delete().eq('id', exam.id); fetchInitialData(); } }} className="p-4 bg-white border border-slate-100 text-slate-400 rounded-2xl hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-32">
             <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-xl sticky top-24 z-50 flex justify-between items-center border border-slate-100">
                <div className="flex items-center gap-4"><div className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black">Câu {Object.keys(studentAnswers).length}/{currentExam.questions.length}</div></div>
                <div className="text-2xl font-black text-indigo-600 tabular-nums bg-indigo-50 px-6 py-2 rounded-2xl border border-indigo-100"><Clock size={20} className="inline mr-3 mb-1"/>{formatTime(timer)}</div>
             </div>
             
             {currentExam.questions.map((q, idx) => (
                <div key={idx} className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 relative overflow-hidden">
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
                     <textarea 
                        className="w-full p-8 rounded-[32px] bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-medium text-lg min-h-[250px] shadow-inner transition-all" 
                        placeholder="Nhập bài làm tự luận của em tại đây..."
                        value={studentAnswers[q.id] || ''}
                        onChange={(e) => setStudentAnswers({...studentAnswers, [q.id]: e.target.value})}
                     />
                   )}
                </div>
             ))}
             <button onClick={handleStudentSubmit} className="w-full bg-emerald-500 text-white py-8 rounded-[40px] font-black text-3xl shadow-2xl hover:bg-emerald-600 transition-all transform hover:scale-[1.02] active:scale-95">NỘP BÀI THI</button>
          </div>
        )}

        {mode === AppMode.VIEW_SUBMISSIONS && currentExam && (
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-400 hover:text-indigo-600 transition-colors"><ArrowLeft size={24}/></button>
                   <div><h1 className="text-3xl font-black text-slate-800 tracking-tight">Giám sát bài làm</h1><p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{currentExam.title}</p></div>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest border border-emerald-100"><Activity size={16} className="animate-pulse"/> Realtime Monitor</div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                   {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => setSelectedSubmission(s)}
                        className={`p-6 rounded-3xl border-2 transition-all cursor-pointer ${selectedSubmission?.id === s.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl translate-x-1' : 'bg-white border-slate-50 hover:border-indigo-100'}`}
                      >
                         <div className="font-black text-lg">{s.student_name}</div>
                         <div className={`text-xs font-bold ${selectedSubmission?.id === s.id ? 'text-indigo-100' : 'text-slate-400'}`}>{s.class_name} • {formatTime(s.time_spent)}</div>
                         <div className="mt-4 flex justify-between items-center">
                            <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black ${selectedSubmission?.id === s.id ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>Tổng điểm: {s.score}/{s.total}</span>
                            <ChevronRight size={18}/>
                         </div>
                      </div>
                   ))}
                </div>
                
                <div className="lg:col-span-2 bg-white rounded-[48px] shadow-2xl border border-slate-100 p-12 overflow-y-auto max-h-[75vh] custom-scrollbar">
                   {selectedSubmission ? (
                     <div className="space-y-12">
                        <div className="border-b border-slate-100 pb-10 flex justify-between items-start">
                           <div>
                              <h2 className="text-4xl font-black text-slate-800 mb-2">{selectedSubmission.student_name}</h2>
                              <div className="flex gap-4">
                                <p className="text-slate-400 font-bold uppercase text-xs bg-slate-50 px-3 py-1 rounded-lg">Lớp: {selectedSubmission.class_name}</p>
                                <p className="text-slate-400 font-bold uppercase text-xs bg-slate-50 px-3 py-1 rounded-lg">Nộp: {new Date(selectedSubmission.submitted_at).toLocaleTimeString('vi-VN')}</p>
                              </div>
                           </div>
                           <div className="bg-slate-900 text-white px-10 py-6 rounded-[32px] text-center shadow-xl">
                              <div className="text-4xl font-black">{selectedSubmission.score}</div>
                              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Tổng điểm tích lũy</div>
                              <div className="text-[10px] text-slate-600 font-bold mt-1">Trên thang {selectedSubmission.total}</div>
                           </div>
                        </div>
                        <div className="space-y-10">
                           {currentExam.questions.map((q, idx) => {
                             const studentAnswer = selectedSubmission.answers[q.id];
                             const isCorrect = q.type === 'mcq' && studentAnswer === q.correctAnswerIndex;
                             
                             return (
                               <div key={idx} className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 relative group transition-all hover:bg-slate-100/50">
                                  <div className="flex justify-between items-start mb-6">
                                     <p className="font-black text-slate-800 text-xl leading-tight pr-10">Câu {idx+1}: {q.prompt}</p>
                                     <span className={`shrink-0 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${q.type === 'mcq' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {q.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}
                                     </span>
                                  </div>
                                  
                                  {q.type === 'mcq' ? (
                                    <div className="space-y-4">
                                       <div className={`p-6 rounded-3xl border-2 font-bold transition-all ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                          <div className="text-[10px] uppercase tracking-widest opacity-60 mb-3 flex items-center gap-2">
                                             {isCorrect ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                                             Học sinh đã chọn:
                                          </div>
                                          <div className="flex items-center gap-4">
                                             <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg text-xl ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                                {studentAnswer !== undefined ? String.fromCharCode(65 + (studentAnswer as number)) : '?'}
                                             </span>
                                             <span className="text-xl leading-tight">{studentAnswer !== undefined ? q.options?.[studentAnswer] : '(Không chọn)'}</span>
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-3 px-4 py-3 bg-white/50 rounded-2xl border border-slate-200/50 text-sm font-bold text-slate-500">
                                          <CheckCircle2 size={16} className="text-emerald-500"/>
                                          <span>Đáp án đúng:</span>
                                          <span className="text-slate-800 font-black">{String.fromCharCode(65 + (q.correctAnswerIndex || 0))}. {q.options?.[q.correctAnswerIndex || 0]}</span>
                                       </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-5">
                                       <div className="bg-white p-8 rounded-3xl border-2 border-indigo-100 font-medium text-slate-700 leading-relaxed shadow-inner">
                                          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <FileText size={14}/> Bài làm của học sinh:
                                          </div>
                                          <div className="italic text-xl whitespace-pre-wrap text-slate-800">
                                            {studentAnswer || '(Học sinh để trống bài này)'}
                                          </div>
                                       </div>
                                       <div className="flex flex-col md:flex-row gap-4">
                                         <div className="flex-1 bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                                            <span className="font-black text-emerald-700 uppercase text-[10px] tracking-widest block mb-2">Đáp án mẫu / Gợi ý:</span>
                                            <span className="text-emerald-900 text-sm leading-relaxed block font-medium">{q.sampleAnswer || "Không có đáp án mẫu."}</span>
                                         </div>
                                         <div className="md:w-32 bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex flex-col items-center justify-center text-center">
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">AI Chấm</span>
                                            <span className="text-3xl font-black text-indigo-700">? / 1</span>
                                            <span className="text-[8px] font-bold text-indigo-300 uppercase mt-1">Hệ thống đang lưu vết</span>
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
                     <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-40">
                        <Eye size={80} className="mb-8"/>
                        <p className="font-black text-2xl uppercase tracking-tighter">Bảng điều khiển giám sát</p>
                        <p className="text-sm font-bold mt-2">Chọn một học sinh từ danh sách bên trái để kiểm soát chi tiết</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
        )}

        {/* Các mode khác giữ nguyên cấu trúc cũ */}
        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
             <div className="bg-white/90 backdrop-blur-md p-10 rounded-[40px] shadow-xl border border-emerald-100 sticky top-24 z-50 flex justify-between items-center">
                <div>
                   <h2 className="text-3xl font-black text-emerald-600 tracking-tight">AI đã bóc tách xong!</h2>
                   <p className="text-slate-500 font-medium">Đã phân loại {currentExam.questions.filter(q => q.type === 'mcq').length} câu trắc nghiệm & {currentExam.questions.filter(q => q.type === 'essay').length} câu tự luận.</p>
                </div>
                <button onClick={async () => { await supabase.from('exams').insert([currentExam]); fetchInitialData(); setMode(AppMode.TEACHER_DASHBOARD); }} className="bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black text-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">LƯU & XUẤT BẢN</button>
             </div>
             {currentExam.questions.map((q, idx) => (
               <div key={idx} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl text-[10px] font-black uppercase tracking-widest ${q.type === 'mcq' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>{q.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}</div>
                  <p className="font-bold text-xl mb-8 pr-12">Câu {idx+1}: {q.prompt}</p>
                  {q.type === 'mcq' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {q.options?.map((opt, oIdx) => (
                         <div key={oIdx} className={`p-5 rounded-2xl border-2 font-bold transition-all ${oIdx === q.correctAnswerIndex ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                           <span className="mr-3 opacity-40">{String.fromCharCode(65+oIdx)}.</span> {opt}
                         </div>
                       ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-center italic">Học sinh sẽ nhập văn bản tự luận tại đây</div>
                      {q.sampleAnswer && (
                        <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Đáp án mẫu:</span>
                          <p className="text-emerald-900 text-sm font-medium">{q.sampleAnswer}</p>
                        </div>
                      )}
                    </div>
                  )}
               </div>
             ))}
          </div>
        )}

        {mode === AppMode.STUDENT_ENTRY && (
          <div className="max-w-md mx-auto py-20 animate-fade-in">
             <div className="bg-white p-12 rounded-[64px] shadow-2xl text-center border border-slate-50">
                <div className="w-24 h-24 bg-indigo-600 rounded-[32px] flex items-center justify-center text-white mx-auto mb-10 shadow-2xl rotate-3"><FileText size={48}/></div>
                <h2 className="text-4xl font-black mb-10 text-slate-800 tracking-tighter">Khu vực Học sinh</h2>
                <div className="space-y-4 mb-10">
                   <input type="text" placeholder="Họ và tên của em" className="w-full p-6 rounded-[24px] bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold text-lg" value={studentName} onChange={e => setStudentName(e.target.value)} />
                   <input type="text" placeholder="Lớp" className="w-full p-6 rounded-[24px] bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold text-lg" value={className} onChange={e => setClassName(e.target.value)} />
                   <input type="text" placeholder="Nhập mã phòng thi..." className="w-full p-8 rounded-[24px] bg-slate-900 text-white text-center font-black text-3xl tracking-widest placeholder:text-slate-700 uppercase shadow-xl" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
                </div>
                <button onClick={async () => {
                   if(!studentName || !className || !examCodeInput) return alert("Em hãy điền đủ thông tin nhé!");
                   const { data } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
                   if(data?.is_open) { setCurrentExam(data); setMode(AppMode.STUDENT_EXAM); setTimer(0); } else alert("Mã không đúng hoặc phòng thi đã đóng!");
                }} className="w-full bg-indigo-600 text-white py-7 rounded-[32px] font-black text-2xl hover:bg-indigo-700 shadow-2xl transition-all transform active:scale-95">BẮT ĐẦU THI</button>
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
          <div className="max-w-md mx-auto py-20 text-center animate-fade-in">
             <div className="bg-white p-16 rounded-[72px] shadow-2xl border border-slate-50">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-10"><CheckCircle2 size={56}/></div>
                <h2 className="text-4xl font-black mb-3 text-slate-800 tracking-tight">Hoàn thành!</h2>
                <p className="text-slate-400 font-bold mb-12">Bài làm của em đã được AI chấm & lưu trữ</p>
                <div className="bg-slate-900 text-white p-12 rounded-[48px] mb-12 shadow-2xl transform hover:scale-105 transition-transform">
                   <div className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-slate-500">Kết quả cuối cùng</div>
                   <div className="text-7xl font-black">{currentSubmission.score}<span className="text-3xl text-slate-500 ml-1">/{currentSubmission.total}</span></div>
                   <div className="mt-6 flex flex-col gap-1">
                      <div className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Đã bao gồm điểm tự luận</div>
                      <div className="text-[10px] text-slate-500 font-bold italic opacity-60">Chấm bởi AI English Teacher</div>
                   </div>
                </div>
                <button onClick={() => window.location.reload()} className="w-full py-4 text-slate-400 font-black hover:text-slate-900 transition-colors uppercase tracking-widest text-xs">Về màn hình chính</button>
             </div>
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
