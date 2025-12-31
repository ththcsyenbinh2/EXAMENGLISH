
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
  ClipboardList, Eye, EyeOff
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
  const [showDebug, setShowDebug] = useState(false);
  
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [examCodeInput, setExamCodeInput] = useState('');
  const [studentAnswers, setStudentAnswers] = useState<Record<string, number>>({});
  const [currentSubmission, setCurrentSubmission] = useState<StudentSubmission | null>(null);
  const [timer, setTimer] = useState(0);

  const getSafeEnv = (key: string) => {
    try { return (process.env as any)[key] || ''; } catch { return ''; }
  };

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (configured) {
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
  }, [configured]);

  useEffect(() => {
    let interval: any;
    if (mode === AppMode.STUDENT_EXAM) {
      interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [mode]);

  const fetchInitialData = async () => {
    if (!configured) return;
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
      setDbError(e.message || "Không thể kết nối Database. Hãy kiểm tra bạn đã tạo bảng trong Supabase chưa?");
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
      setLoadingStep('AI đang bóc tách đề...');
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
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveExamToCloud = async () => {
    if (!currentExam) return;
    setIsDbLoading(true);
    try {
      const { error } = await supabase.from('exams').insert([currentExam]);
      if (error) throw error;
      await fetchInitialData();
      alert("Đã lưu đề thi thành công!");
      setMode(AppMode.TEACHER_DASHBOARD);
    } catch (error: any) {
      alert("Lỗi: " + error.message);
    } finally {
      setIsDbLoading(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (!configured || dbError) {
    const sUrl = getSafeEnv('SUPABASE_URL');
    const sKey = getSafeEnv('SUPABASE_ANON_KEY');
    
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-xl w-full bg-white p-10 rounded-[40px] shadow-2xl border border-red-100">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ServerCrash size={40}/>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Chưa kết nối Cloud</h2>
          <p className="text-slate-500 mb-8 font-medium">Vui lòng kiểm tra lại cấu hình Supabase trên Vercel.</p>
          
          <div className="bg-slate-50 p-6 rounded-3xl text-left mb-8 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Kiểm tra nhanh</span>
              <button onClick={() => setShowDebug(!showDebug)} className="text-indigo-600 text-xs font-bold flex items-center gap-1">
                {showDebug ? <EyeOff size={14}/> : <Eye size={14}/>} {showDebug ? "Ẩn chi tiết" : "Hiện chi tiết"}
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600">SUPABASE_URL:</span>
                <span className={`text-xs font-black ${sUrl ? 'text-emerald-500' : 'text-red-400'}`}>
                  {sUrl ? (showDebug ? sUrl : '✅ ĐÃ NHẬN') : '❌ TRỐNG'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600">SUPABASE_ANON_KEY:</span>
                <span className={`text-xs font-black ${sKey ? 'text-emerald-500' : 'text-red-400'}`}>
                  {sKey ? (showDebug ? `${sKey.substring(0, 10)}...` : '✅ ĐÃ NHẬN') : '❌ TRỐNG'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-left bg-indigo-50 p-6 rounded-3xl mb-8">
            <h4 className="font-black text-indigo-700 text-sm mb-3">⚠️ Bước quan trọng để sửa lỗi:</h4>
            <ol className="list-decimal list-inside text-xs font-bold text-indigo-600/70 space-y-2">
              <li>Bạn hãy vào Vercel, chọn dự án này.</li>
              <li>Vào tab <b>Deployments</b>.</li>
              <li>Tìm bản deploy mới nhất, nhấn vào dấu 3 chấm <b>(...)</b>.</li>
              <li>Chọn <b>Redeploy</b> (Bắt buộc để nạp biến môi trường).</li>
            </ol>
          </div>

          <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3 hover:bg-black transition-all">
            <RefreshCw size={20}/> Tôi đã Redeploy, Thử lại
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
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5 block">Cloud Live</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={fetchInitialData} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400">
              <RefreshCw size={20} className={isDbLoading ? 'animate-spin' : ''}/>
            </button>
          </div>
        </div>
      </header>

      <main className="py-8 px-6 max-w-7xl mx-auto">
        {isProcessing && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6 text-center">
            <div className="bg-white p-12 rounded-[48px] shadow-2xl max-w-lg w-full">
               <CloudLightning size={48} className="text-indigo-600 animate-pulse mx-auto mb-6"/>
               <h2 className="text-2xl font-black mb-2">{loadingStep}</h2>
               <p className="text-slate-400 font-bold">Vui lòng đợi trong giây lát...</p>
            </div>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && (
          <div className="space-y-10 animate-fade-in">
             <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-10 rounded-[48px] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
                <div>
                  <h1 className="text-4xl font-black mb-4">Quản lý Đề thi Cloud 👋</h1>
                  <p className="text-indigo-100 font-medium">Học sinh có thể thi từ bất cứ đâu bằng mã phòng.</p>
                </div>
                <label className="bg-white text-indigo-600 px-10 py-5 rounded-3xl font-black text-xl shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-3">
                  <Plus size={24}/> Tạo đề mới
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                </label>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-center mb-6">
                      <span className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">MÃ: {exam.exam_code}</span>
                      <div className={`px-3 py-1.5 rounded-full text-[10px] font-black ${exam.is_open ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                        {exam.is_open ? 'ONLINE' : 'OFFLINE'}
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-6 line-clamp-2 h-14">{exam.title}</h3>
                    <div className="flex gap-2">
                       <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm">Xem Điểm</button>
                       <button onClick={() => {
                          const link = `${window.location.origin}${window.location.pathname}#hocsinh`;
                          navigator.clipboard.writeText(link);
                          alert("Đã copy link học sinh!");
                       }} className="p-4 bg-white border border-slate-100 text-indigo-600 rounded-2xl hover:bg-indigo-50 transition-colors"><Share2 size={20}/></button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_ENTRY && (
          <div className="max-w-md mx-auto py-12 animate-fade-in">
             <div className="bg-white p-12 rounded-[56px] shadow-2xl border border-slate-100">
                <h2 className="text-3xl font-black text-center mb-10">Phòng thi Online</h2>
                <div className="space-y-4 mb-10">
                  <input type="text" placeholder="Họ và tên" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold" value={studentName} onChange={e => setStudentName(e.target.value)} />
                  <input type="text" placeholder="Lớp" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold" value={className} onChange={e => setClassName(e.target.value)} />
                  <input type="text" placeholder="MÃ PHÒNG" className="w-full p-6 rounded-3xl bg-indigo-50 border-2 border-indigo-200 text-center font-black text-indigo-600 uppercase text-3xl" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
                </div>
                <button onClick={async () => {
                   if(!studentName || !className || !examCodeInput) return alert("Vui lòng điền đủ thông tin!");
                   setIsDbLoading(true);
                   const { data, error } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
                   if(data && data.is_open) {
                      setCurrentExam(data); setStudentAnswers({}); setTimer(0); setMode(AppMode.STUDENT_EXAM);
                   } else {
                      alert("Mã phòng không tồn tại hoặc đã đóng!");
                   }
                   setIsDbLoading(false);
                }} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black text-xl shadow-lg">VÀO THI</button>
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
             <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-xl sticky top-24 z-50 flex justify-between items-center border border-indigo-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black">{currentExam.questions.length}</div>
                  <h2 className="font-black text-slate-800 truncate max-w-[200px]">{currentExam.title}</h2>
                </div>
                <div className="bg-indigo-50 px-6 py-2.5 rounded-2xl font-black text-indigo-600 text-2xl tabular-nums">
                  {formatTime(timer)}
                </div>
             </div>
             {currentExam.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
                   <p className="text-xl font-bold text-slate-800 mb-8"><span className="text-indigo-600 mr-2">Câu {idx+1}:</span> {q.prompt}</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options.map((opt, oIdx) => (
                        <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`p-6 rounded-2xl border-2 font-bold text-left transition-all ${studentAnswers[q.id] === oIdx ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'}`}>
                           {String.fromCharCode(65+oIdx)}. {opt}
                        </button>
                      ))}
                   </div>
                </div>
             ))}
             <button onClick={async () => {
                if(!confirm("Xác nhận nộp bài?")) return;
                let score = 0;
                currentExam.questions.forEach(q => { if(studentAnswers[q.id] === q.correctAnswerIndex) score++; });
                const payload = { 
                   id: Math.random().toString(36).substring(2, 11),
                   exam_id: currentExam.id, student_name: studentName, class_name: className, 
                   answers: studentAnswers, score, total: currentExam.questions.length, 
                   time_spent: timer, submitted_at: new Date().toISOString() 
                };
                setIsDbLoading(true);
                const { error } = await supabase.from('submissions').insert([payload]);
                if(!error) { setCurrentSubmission(payload as any); setMode(AppMode.STUDENT_RESULT); }
                else alert("Lỗi nộp bài: " + error.message);
                setIsDbLoading(false);
             }} className="w-full bg-emerald-500 text-white py-8 rounded-[40px] font-black text-3xl shadow-xl">NỘP BÀI THI</button>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
           <div className="max-w-md mx-auto py-12 text-center animate-fade-in">
              <div className="bg-white p-14 rounded-[64px] shadow-2xl">
                 <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8"><Trophy size={48}/></div>
                 <h2 className="text-4xl font-black mb-10 text-slate-800">Kết quả: {currentSubmission.score}/{currentSubmission.total}</h2>
                 <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xl">Hoàn thành</button>
              </div>
           </div>
        )}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
             <div className="bg-white p-10 rounded-[48px] shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 border border-emerald-100">
                <div className="text-center md:text-left">
                  <h2 className="text-3xl font-black mb-2 text-emerald-600">Bóc tách hoàn tất!</h2>
                  <p className="text-slate-500 font-medium">Kiểm tra lại đề thi và nhấn Lưu để công khai mã phòng.</p>
                </div>
                <button onClick={saveExamToCloud} className="w-full md:w-auto bg-indigo-600 text-white px-12 py-5 rounded-3xl font-black text-xl shadow-xl">LƯU ĐỀ CLOUD</button>
             </div>
             {currentExam.questions.map((q, idx) => (
                <div key={idx} className="bg-white p-10 rounded-[40px] border border-slate-100">
                   <p className="font-bold text-lg mb-6">{idx+1}. {q.prompt}</p>
                   <div className="grid grid-cols-2 gap-4">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className={`p-4 rounded-xl border-2 font-bold ${oIdx === q.correctAnswerIndex ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                           {String.fromCharCode(65+oIdx)}. {opt}
                        </div>
                      ))}
                   </div>
                </div>
             ))}
          </div>
        )}

        {mode === AppMode.VIEW_SUBMISSIONS && currentExam && (
          <div className="space-y-8 animate-fade-in">
             <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="p-4 bg-white rounded-2xl shadow-sm text-slate-400 hover:text-indigo-600 transition-colors"><ArrowLeft size={24}/></button>
             <h1 className="text-3xl font-black text-slate-800">Bảng điểm: {currentExam.title}</h1>
             <div className="bg-white rounded-[40px] shadow-xl overflow-hidden border border-slate-100">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-10 py-6">Học sinh</th>
                        <th className="px-10 py-6">Lớp</th>
                        <th className="px-10 py-6 text-center">Điểm</th>
                        <th className="px-10 py-6 text-right">Ngày thi</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                        <tr key={s.id} className="hover:bg-slate-50">
                           <td className="px-10 py-6 font-black text-slate-800">{s.student_name}</td>
                           <td className="px-10 py-6 font-bold text-slate-400">{s.class_name}</td>
                           <td className="px-10 py-6 text-center font-black text-indigo-600 text-xl">{s.score} / {s.total}</td>
                           <td className="px-10 py-6 text-right text-slate-300 text-xs font-bold">{new Date(s.submitted_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
