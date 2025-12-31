
import React, { useState, useEffect } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText } from './services/geminiService';
import { supabase, isSupabaseConfigured, getSupabaseConfig } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, Trash2, Trophy, Clock, Users, ArrowLeft, 
  Database, Lock, Unlock, FileText, RefreshCw, CheckCircle2, 
  CloudLightning, Settings, ServerCrash, ClipboardList, Info, Save, XCircle, AlertTriangle, Link2, Copy, ExternalLink
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
  
  const [showSetup, setShowSetup] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [inputKey, setInputKey] = useState('');

  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [examCodeInput, setExamCodeInput] = useState('');
  const [studentAnswers, setStudentAnswers] = useState<Record<string, number>>({});
  const [currentSubmission, setCurrentSubmission] = useState<StudentSubmission | null>(null);
  const [timer, setTimer] = useState(0);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (configured) {
      fetchInitialData();
    } else {
      if (window.location.hash !== '#hocsinh') {
        setShowSetup(true);
      }
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
    if (!isSupabaseConfigured()) return;
    setIsDbLoading(true);
    setDbError(null);
    try {
      const { data: exData, error: exErr } = await supabase
        .from('exams')
        .select('id, exam_code, title, questions, is_open, created_at')
        .order('created_at', { ascending: false });
      
      if (exErr) throw exErr;
      setExams(exData || []);
      
      const { data: subData, error: subErr } = await supabase
        .from('submissions')
        .select('id, exam_id, student_name, class_name, answers, score, total, submitted_at, time_spent')
        .order('submitted_at', { ascending: false });
        
      if (subErr) throw subErr;
      setSubmissions(subData || []);
    } catch (e: any) {
      console.error("Fetch Error:", e);
      setDbError(e.message);
    } finally {
      setIsDbLoading(false);
    }
  };

  const generateAdminLink = () => {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) return alert("Vui lòng cấu hình Database trước!");
    const baseUrl = window.location.origin + window.location.pathname;
    const portableLink = `${baseUrl}?s_url=${encodeURIComponent(url)}&s_key=${encodeURIComponent(key)}`;
    navigator.clipboard.writeText(portableLink);
    alert("Đã copy Link Quản Trị Di Động!\n\nHãy lưu link này vào Email hoặc Zalo. Khi mở link này ở bất kỳ máy tính nào khác, hệ thống sẽ tự động đăng nhập và kết nối Database.");
  };

  const handleSaveConfig = () => {
    if (!inputUrl.trim().startsWith('https://') || inputKey.trim().length < 20) {
      alert("Thông tin cấu hình không hợp lệ!");
      return;
    }
    localStorage.setItem('ST_SUPABASE_URL', inputUrl.trim());
    localStorage.setItem('ST_SUPABASE_ANON_KEY', inputKey.trim());
    alert("Cấu hình đã được lưu!");
    window.location.reload();
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
        id: crypto.randomUUID(),
        exam_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        title: extracted.title,
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
      const payload = {
        id: currentExam.id,
        exam_code: currentExam.exam_code,
        title: currentExam.title,
        questions: currentExam.questions,
        is_open: currentExam.is_open,
        created_at: currentExam.created_at
      };

      const { error } = await supabase.from('exams').insert([payload]);
      if (error) throw error;
      
      await fetchInitialData();
      alert("Đã lưu đề thi lên Cloud!");
      setMode(AppMode.TEACHER_DASHBOARD);
    } catch (error: any) {
      console.error("Insert Error:", error);
      setDbError(error.message);
      alert("Lỗi lưu trữ: " + error.message);
    } finally {
      setIsDbLoading(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (showSetup) {
    const currentCfg = getSupabaseConfig();
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white p-12 rounded-[40px] shadow-2xl border border-slate-200 animate-fade-in relative">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-slate-900 p-3 rounded-2xl text-white">
              <Database size={28}/>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">Kết nối Hệ thống Cloud</h2>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Enterprise Connection</p>
            </div>
          </div>

          <div className="bg-indigo-50 border-2 border-indigo-100 p-6 rounded-3xl mb-8">
            <div className="flex items-center gap-2 mb-2 text-indigo-600 font-black text-xs uppercase tracking-widest">
               <Info size={16}/> Mẹo Chuyên Nghiệp
            </div>
            <p className="text-indigo-900 text-sm font-medium leading-relaxed">
              Sau khi lưu cấu hình, hãy sử dụng nút <b>"Tạo Link Quản Trị"</b> để đồng bộ toàn bộ dữ liệu sang máy tính khác mà không cần nhập lại mã.
            </p>
          </div>

          <div className="space-y-5 mb-10">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Supabase Project URL</label>
              <input 
                type="text" 
                placeholder="https://xyz.supabase.co" 
                className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-slate-900 outline-none font-bold text-slate-700 transition-all"
                value={inputUrl || currentCfg.url}
                onChange={e => setInputUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Supabase Anon Key</label>
              <textarea 
                placeholder="Dán mã bảo mật tại đây..." 
                className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-slate-900 outline-none font-bold text-slate-700 h-24 transition-all"
                value={inputKey || currentCfg.key}
                onChange={e => setInputKey(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleSaveConfig}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95"
            >
              <Save size={20}/> XÁC NHẬN KẾT NỐI
            </button>
            <button 
              onClick={() => {
                if(isSupabaseConfigured()) setShowSetup(false);
                else alert("Vui lòng cấu hình hệ thống!");
              }}
              className="w-full py-4 rounded-2xl font-black text-slate-400 border border-slate-100 hover:bg-slate-50 transition-all"
            >
              Để sau
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] font-sans text-slate-900">
      <header className="bg-white/80 border-b border-slate-100 py-4 px-6 sticky top-0 z-[100] backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.hash = ''}>
            <div className="bg-slate-900 p-2.5 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <GraduationCap size={24}/>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block leading-none">Smart<span className="text-indigo-600">Exam</span></span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5 block">Cloud Enterprise</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {configured && (
              <button 
                onClick={generateAdminLink}
                className="hidden md:flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-xl text-xs font-black border border-indigo-100 hover:bg-indigo-100 transition-all"
                title="Tạo link để mở trên máy tính khác không cần nhập Key"
              >
                <Link2 size={16}/> LINK QUẢN TRỊ
              </button>
            )}
            <button onClick={() => setShowSetup(true)} className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900">
              <Settings size={20}/>
            </button>
            <button onClick={fetchInitialData} className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400">
              <RefreshCw size={20} className={isDbLoading ? 'animate-spin' : ''}/>
            </button>
          </div>
        </div>
      </header>

      <main className="py-8 px-6 max-w-7xl mx-auto">
        {isProcessing && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6 text-center">
            <div className="bg-white p-12 rounded-[48px] shadow-2xl max-w-lg w-full scale-in">
               <CloudLightning size={48} className="text-indigo-600 animate-bounce mx-auto mb-6"/>
               <h2 className="text-2xl font-black mb-2">{loadingStep}</h2>
               <p className="text-slate-400 font-bold">Vui lòng chờ giây lát...</p>
            </div>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && (
          <div className="space-y-10 animate-fade-in">
             <div className="bg-slate-900 p-12 rounded-[48px] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden group">
                <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/5 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
                <div className="relative z-10">
                  <h1 className="text-4xl font-black mb-4 tracking-tight">Hệ thống Đề thi Cloud 👋</h1>
                  <p className="text-slate-400 font-medium text-lg">Dữ liệu được lưu trữ tập trung và bảo mật trên hạ tầng Cloud.</p>
                </div>
                <label className="relative z-10 bg-white text-slate-900 px-10 py-5 rounded-[28px] font-black text-xl shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-3">
                  <Plus size={24}/> TẢI FILE WORD (.DOCX)
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                </label>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col min-h-[280px]">
                    <div className="flex justify-between items-center mb-6">
                      <span className="bg-slate-50 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">PHÒNG: {exam.exam_code}</span>
                      <button 
                        onClick={async () => {
                          const { error } = await supabase.from('exams').update({ is_open: !exam.is_open }).eq('id', exam.id);
                          if(!error) fetchInitialData();
                        }}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${exam.is_open ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-400'}`}>
                        {exam.is_open ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                      </button>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-6 line-clamp-2 h-14">{exam.title}</h3>
                    <div className="flex gap-2 mt-auto pt-6 border-t border-slate-50">
                       <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors">BẢNG ĐIỂM</button>
                       <button onClick={() => {
                          const link = `${window.location.origin}${window.location.pathname}#hocsinh`;
                          navigator.clipboard.writeText(link);
                          alert("Đã copy link học sinh!");
                       }} className="p-4 bg-white border border-slate-100 text-slate-400 rounded-2xl hover:text-indigo-600 transition-colors"><Share2 size={20}/></button>
                       <button 
                        onClick={async () => {
                          if(confirm("Xóa đề này khỏi hệ thống Cloud?")) {
                            const { error } = await supabase.from('exams').delete().eq('id', exam.id);
                            if(!error) fetchInitialData();
                          }
                        }}
                        className="p-4 bg-white border border-slate-100 text-slate-400 rounded-2xl hover:text-red-500 transition-colors"
                       >
                        <Trash2 size={20}/>
                       </button>
                    </div>
                  </div>
                ))}
                {exams.length === 0 && !isDbLoading && (
                  <div className="col-span-full py-20 text-center bg-slate-50 rounded-[48px] border-2 border-dashed border-slate-200">
                    <ClipboardList size={48} className="text-slate-200 mx-auto mb-4"/>
                    <p className="text-slate-400 font-bold">Chưa có dữ liệu đề thi trên Cloud.</p>
                  </div>
                )}
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_ENTRY && (
          <div className="max-w-md mx-auto py-12 animate-fade-in">
             <div className="bg-white p-12 rounded-[56px] shadow-2xl border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-3 bg-slate-900"></div>
                <h2 className="text-3xl font-black text-center mb-10 tracking-tight text-slate-800">Phòng thi Online</h2>
                <div className="space-y-4 mb-10">
                  <input type="text" placeholder="Họ và tên học sinh" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-slate-900 outline-none font-bold" value={studentName} onChange={e => setStudentName(e.target.value)} />
                  <input type="text" placeholder="Lớp" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-slate-900 outline-none font-bold" value={className} onChange={e => setClassName(e.target.value)} />
                  <div className="pt-4 border-t border-slate-100 mt-6">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Mã phòng thi</label>
                    <input type="text" placeholder="ABCXYZ" className="w-full p-6 rounded-3xl bg-slate-900 border-2 border-slate-900 text-center font-black text-white uppercase text-3xl tracking-widest" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
                  </div>
                </div>
                <button onClick={async () => {
                   if(!studentName || !className || !examCodeInput) return alert("Vui lòng điền đủ thông tin!");
                   setIsDbLoading(true);
                   const { data, error } = await supabase.from('exams').select('id, is_open, questions, title').eq('exam_code', examCodeInput.toUpperCase()).single();
                   if(data && data.is_open) {
                      setCurrentExam(data as any); setStudentAnswers({}); setTimer(0); setMode(AppMode.STUDENT_EXAM);
                   } else {
                      alert("Mã phòng sai hoặc phòng thi đã đóng!");
                   }
                   setIsDbLoading(false);
                }} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xl shadow-xl hover:bg-black transition-all active:scale-95">VÀO PHÒNG THI</button>
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_EXAM && currentExam && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
             <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-xl sticky top-24 z-50 flex justify-between items-center border border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black">{currentExam.questions.length}</div>
                  <h2 className="font-black text-slate-800 truncate max-w-[200px]">{currentExam.title}</h2>
                </div>
                <div className="bg-slate-50 px-6 py-2.5 rounded-2xl font-black text-slate-900 text-2xl tabular-nums">
                  <Clock size={20} className="inline mr-2 mb-1"/>
                  {formatTime(timer)}
                </div>
             </div>
             {currentExam.questions.map((q, idx) => (
                <div key={idx} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
                   <p className="text-xl font-bold text-slate-800 mb-8"><span className="text-slate-400 mr-2">{idx+1}.</span> {q.prompt}</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options.map((opt, oIdx) => (
                        <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`p-6 rounded-2xl border-2 font-bold text-left transition-all ${studentAnswers[q.id] === oIdx ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'}`}>
                           <span className={`inline-block w-8 h-8 rounded-lg text-center leading-8 mr-3 ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-white text-slate-900'}`}>{String.fromCharCode(65+oIdx)}</span>
                           {opt}
                        </button>
                      ))}
                   </div>
                </div>
             ))}
             <button onClick={async () => {
                if(!confirm("Xác nhận nộp bài thi?")) return;
                let score = 0;
                currentExam.questions.forEach(q => { if(studentAnswers[q.id] === q.correctAnswerIndex) score++; });
                
                const payload = { 
                   id: crypto.randomUUID(),
                   exam_id: currentExam.id, student_name: studentName, class_name: className, 
                   answers: studentAnswers, score, total: currentExam.questions.length, 
                   time_spent: timer, submitted_at: new Date().toISOString() 
                };
                setIsDbLoading(true);
                const { error } = await supabase.from('submissions').insert([payload]);
                if(!error) { setCurrentSubmission(payload as any); setMode(AppMode.STUDENT_RESULT); }
                else alert("Lỗi khi nộp bài: " + error.message);
                setIsDbLoading(false);
             }} className="w-full bg-emerald-600 text-white py-8 rounded-[40px] font-black text-3xl shadow-xl hover:bg-emerald-700 transition-all active:scale-95">NỘP BÀI THI</button>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
           <div className="max-w-md mx-auto py-12 text-center animate-fade-in">
              <div className="bg-white p-14 rounded-[64px] shadow-2xl border border-slate-50">
                 <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8"><Trophy size={48} className="animate-bounce"/></div>
                 <h2 className="text-4xl font-black mb-4 text-slate-800">Xong!</h2>
                 <p className="text-slate-400 font-bold mb-10">Kết quả của bạn đã lưu lên hệ thống</p>
                 <div className="bg-slate-900 p-10 rounded-[40px] mb-10 transform hover:scale-105 transition-transform">
                    <div className="text-6xl font-black text-white">{currentSubmission.score}<span className="text-2xl text-slate-500">/{currentSubmission.total}</span></div>
                    <div className="text-xs font-black text-slate-500 uppercase tracking-widest mt-2">ĐIỂM SỐ</div>
                 </div>
                 <button onClick={() => window.location.reload()} className="w-full bg-slate-100 text-slate-900 py-6 rounded-3xl font-black text-xl hover:bg-slate-200 transition-all">THOÁT</button>
              </div>
           </div>
        )}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
             <div className="bg-white p-10 rounded-[48px] shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 border border-emerald-100 sticky top-24 z-50 backdrop-blur-md bg-white/90">
                <div className="text-center md:text-left">
                  <h2 className="text-3xl font-black mb-2 text-emerald-600">AI trích xuất thành công!</h2>
                  <p className="text-slate-500 font-medium">Bạn có thể kiểm tra lại đề trước khi xuất bản lên Cloud.</p>
                </div>
                <button onClick={saveExamToCloud} className="w-full md:w-auto bg-slate-900 text-white px-12 py-5 rounded-[28px] font-black text-xl shadow-xl hover:bg-black transition-all active:scale-95 flex items-center gap-3 justify-center">
                  <Save size={24}/> XUẤT BẢN CLOUD
                </button>
             </div>
             <div className="space-y-6">
                {currentExam.questions.map((q, idx) => (
                  <div key={idx} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
                     <p className="font-bold text-lg mb-6 text-slate-800"><span className="text-slate-400 mr-2">Câu {idx+1}:</span> {q.prompt}</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className={`p-4 rounded-xl border-2 font-bold ${oIdx === q.correctAnswerIndex ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                             <span className="mr-2">{String.fromCharCode(65+oIdx)}.</span> {opt}
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
             <div className="flex items-center gap-4">
                <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="p-4 bg-white rounded-2xl shadow-sm text-slate-400 hover:text-slate-900 transition-all border border-slate-100"><ArrowLeft size={24}/></button>
                <div>
                  <h1 className="text-3xl font-black text-slate-800 tracking-tight">Kết quả học sinh</h1>
                  <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">{currentExam.title}</p>
                </div>
             </div>
             <div className="bg-white rounded-[48px] shadow-xl overflow-hidden border border-slate-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-10 py-8">Học sinh</th>
                          <th className="px-10 py-8">Lớp</th>
                          <th className="px-10 py-8 text-center">Điểm số</th>
                          <th className="px-10 py-8 text-center">Thời lượng</th>
                          <th className="px-10 py-8 text-right">Ngày nộp</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-10 py-7 font-black text-slate-800 text-lg">{s.student_name}</td>
                            <td className="px-10 py-7 font-bold text-slate-500">{s.class_name}</td>
                            <td className="px-10 py-7 text-center font-black text-indigo-600 text-2xl">{s.score} <span className="text-sm text-slate-300">/{s.total}</span></td>
                            <td className="px-10 py-7 text-center font-bold text-slate-400">
                              {formatTime(s.time_spent)}
                            </td>
                            <td className="px-10 py-7 text-right text-slate-400 text-xs font-bold">{new Date(s.submitted_at).toLocaleDateString('vi-VN')}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {submissions.filter(s => s.exam_id === currentExam.id).length === 0 && (
                  <div className="p-20 text-center text-slate-400 font-bold flex flex-col items-center gap-4">
                    <Users size={32} className="text-slate-200"/>
                    Chưa có kết quả nào được ghi nhận.
                  </div>
                )}
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
