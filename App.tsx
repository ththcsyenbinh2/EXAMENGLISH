
import React, { useState, useEffect } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText } from './services/geminiService';
import { supabase, isSupabaseConfigured, getSupabaseConfig } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, Trash2, Trophy, Clock, Users, ArrowLeft, 
  Database, Lock, Unlock, FileText, RefreshCw, CheckCircle2, 
  CloudLightning, Settings, ServerCrash, ClipboardList, Info, Save
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
  
  // Cấu hình Database thủ công
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
      const { data: exData, error: exErr } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      if (exErr) throw exErr;
      setExams(exData || []);
      
      const { data: subData, error: subErr } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
      if (subErr) throw subErr;
      setSubmissions(subData || []);
    } catch (e: any) {
      setDbError(e.message || "Lỗi kết nối. Vui lòng kiểm tra lại URL/Key.");
    } finally {
      setIsDbLoading(false);
    }
  };

  const handleSaveConfig = () => {
    if (!inputUrl.startsWith('https://') || inputKey.length < 20) {
      alert("Thông tin cấu hình không hợp lệ. Vui lòng kiểm tra lại!");
      return;
    }
    localStorage.setItem('ST_SUPABASE_URL', inputUrl);
    localStorage.setItem('ST_SUPABASE_ANON_KEY', inputKey);
    alert("Cấu hình đã được lưu! Ứng dụng sẽ tải lại.");
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
        id: Math.random().toString(36).substring(2, 11),
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

  // Màn hình Setup thủ công
  if (showSetup) {
    const currentCfg = getSupabaseConfig();
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white p-10 md:p-14 rounded-[48px] shadow-2xl border border-indigo-100 animate-fade-in">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200">
              <Database size={32}/>
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Cấu hình Cloud</h2>
              <p className="text-slate-400 font-bold text-sm">Kết nối với Database Supabase của bạn</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl mb-10 flex gap-4">
            <Info className="text-amber-500 shrink-0" size={24}/>
            <p className="text-amber-700 text-sm font-medium leading-relaxed">
              Nhập URL và Anon Key từ Supabase Project Settings > API để bắt đầu.
            </p>
          </div>

          <div className="space-y-6 mb-10">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">SUPABASE URL</label>
              <input 
                type="text" 
                placeholder="https://xxx.supabase.co" 
                className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold text-slate-700 transition-all"
                value={inputUrl || currentCfg.url}
                onChange={e => setInputUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">SUPABASE ANON KEY</label>
              <textarea 
                placeholder="Nhập chuỗi Anon Key dài..." 
                className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold text-slate-700 h-32 transition-all"
                value={inputKey || currentCfg.key}
                onChange={e => setInputKey(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <button 
              onClick={handleSaveConfig}
              className="flex-1 bg-indigo-600 text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-95"
            >
              <Save size={24}/> LƯU CẤU HÌNH
            </button>
            <button 
              onClick={() => {
                if(isSupabaseConfigured()) setShowSetup(false);
                else alert("Vui lòng cấu hình trước khi tiếp tục!");
              }}
              className="px-10 py-5 rounded-[24px] font-black text-slate-400 border border-slate-100 hover:bg-slate-50 transition-all"
            >
              Bỏ qua
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
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <GraduationCap size={24}/>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block leading-none">Smart<span className="text-indigo-600">English</span></span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5 block">Cloud Connected</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => setShowSetup(true)} className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-indigo-600 flex items-center gap-2">
              <Settings size={20}/>
              <span className="hidden md:block text-xs font-black">Cài đặt DB</span>
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
            <div className="bg-white p-12 rounded-[48px] shadow-2xl max-w-lg w-full">
               <CloudLightning size={48} className="text-indigo-600 animate-pulse mx-auto mb-6"/>
               <h2 className="text-2xl font-black mb-2">{loadingStep}</h2>
               <p className="text-slate-400 font-bold">AI đang thực hiện bóc tách đề...</p>
            </div>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && (
          <div className="space-y-10 animate-fade-in">
             <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-10 rounded-[48px] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden group">
                <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
                <div className="relative z-10">
                  <h1 className="text-4xl font-black mb-4 tracking-tight">Quản lý Đề thi Cloud 👋</h1>
                  <p className="text-indigo-100 font-medium text-lg">Học sinh có thể thi Online mọi lúc bằng mã phòng.</p>
                </div>
                <label className="relative z-10 bg-white text-indigo-600 px-10 py-5 rounded-[28px] font-black text-xl shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-3">
                  <Plus size={24}/> Tạo đề mới
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                </label>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                      <span className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">MÃ: {exam.exam_code}</span>
                      <button 
                        onClick={async () => {
                          const { error } = await supabase.from('exams').update({ is_open: !exam.is_open }).eq('id', exam.id);
                          if(!error) fetchInitialData();
                        }}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${exam.is_open ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                        {exam.is_open ? <Unlock size={10} className="inline mr-1"/> : <Lock size={10} className="inline mr-1"/>}
                        {exam.is_open ? 'PHÒNG MỞ' : 'PHÒNG ĐÓNG'}
                      </button>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-6 line-clamp-2 h-14 group-hover:text-indigo-600 transition-colors">{exam.title}</h3>
                    <div className="flex gap-2">
                       <button onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm hover:bg-black transition-colors">Xem Điểm</button>
                       <button onClick={() => {
                          const link = `${window.location.origin}${window.location.pathname}#hocsinh`;
                          navigator.clipboard.writeText(link);
                          alert("Đã copy link học sinh!");
                       }} className="p-4 bg-white border border-slate-100 text-indigo-600 rounded-2xl hover:bg-indigo-50 transition-colors"><Share2 size={20}/></button>
                       <button 
                        onClick={async () => {
                          if(confirm("Xóa vĩnh viễn đề này khỏi Cloud?")) {
                            const { error } = await supabase.from('exams').delete().eq('id', exam.id);
                            if(!error) fetchInitialData();
                          }
                        }}
                        className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors"
                       >
                        <Trash2 size={20}/>
                       </button>
                    </div>
                  </div>
                ))}
                {exams.length === 0 && !isDbLoading && (
                  <div className="col-span-full py-20 text-center bg-slate-50 rounded-[48px] border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold">Chưa có đề thi nào trên Cloud. Hãy tải file Word lên!</p>
                  </div>
                )}
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_ENTRY && (
          <div className="max-w-md mx-auto py-12 animate-fade-in">
             <div className="bg-white p-12 rounded-[56px] shadow-2xl border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-3 bg-indigo-600"></div>
                <h2 className="text-3xl font-black text-center mb-10 tracking-tight text-slate-800">Phòng thi Online</h2>
                <div className="space-y-4 mb-10">
                  <input type="text" placeholder="Họ và tên" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold" value={studentName} onChange={e => setStudentName(e.target.value)} />
                  <input type="text" placeholder="Lớp" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold" value={className} onChange={e => setClassName(e.target.value)} />
                  <input type="text" placeholder="MÃ PHÒNG" className="w-full p-6 rounded-3xl bg-indigo-50 border-2 border-indigo-200 text-center font-black text-indigo-600 uppercase text-3xl tracking-widest" value={examCodeInput} onChange={e => setExamCodeInput(e.target.value)} />
                </div>
                <button onClick={async () => {
                   if(!studentName || !className || !examCodeInput) return alert("Vui lòng điền đủ thông tin!");
                   setIsDbLoading(true);
                   const { data, error } = await supabase.from('exams').select('*').eq('exam_code', examCodeInput.toUpperCase()).single();
                   if(data && data.is_open) {
                      setCurrentExam(data); setStudentAnswers({}); setTimer(0); setMode(AppMode.STUDENT_EXAM);
                   } else {
                      alert("Mã phòng không chính xác hoặc phòng thi đang tạm đóng!");
                   }
                   setIsDbLoading(false);
                }} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black text-xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95">VÀO THI NGAY</button>
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
                        <button key={oIdx} onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})} className={`p-6 rounded-2xl border-2 font-bold text-left transition-all ${studentAnswers[q.id] === oIdx ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'}`}>
                           <span className={`inline-block w-8 h-8 rounded-lg text-center leading-8 mr-3 ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-white text-indigo-600'}`}>{String.fromCharCode(65+oIdx)}</span>
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
                   id: Math.random().toString(36).substring(2, 11),
                   exam_id: currentExam.id, student_name: studentName, class_name: className, 
                   answers: studentAnswers, score, total: currentExam.questions.length, 
                   time_spent: timer, submitted_at: new Date().toISOString() 
                };
                setIsDbLoading(true);
                const { error } = await supabase.from('submissions').insert([payload]);
                if(!error) { setCurrentSubmission(payload as any); setMode(AppMode.STUDENT_RESULT); }
                else alert("Lỗi khi nộp bài: " + error.message);
                setIsDbLoading(false);
             }} className="w-full bg-emerald-500 text-white py-8 rounded-[40px] font-black text-3xl shadow-xl hover:bg-emerald-600 transition-all active:scale-95">NỘP BÀI THI</button>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
           <div className="max-w-md mx-auto py-12 text-center animate-fade-in">
              <div className="bg-white p-14 rounded-[64px] shadow-2xl border border-slate-50">
                 <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8"><Trophy size={48}/></div>
                 <h2 className="text-4xl font-black mb-4 text-slate-800">Hoàn thành!</h2>
                 <p className="text-slate-400 font-bold mb-10">Điểm số của bạn đã được ghi nhận</p>
                 <div className="bg-indigo-50 p-10 rounded-[40px] mb-10">
                    <div className="text-6xl font-black text-indigo-600">{currentSubmission.score}<span className="text-2xl text-indigo-300">/{currentSubmission.total}</span></div>
                    <div className="text-xs font-black text-indigo-400 uppercase tracking-widest mt-2">Câu đúng</div>
                 </div>
                 <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xl hover:bg-black transition-all">Về Trang Chủ</button>
              </div>
           </div>
        )}

        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
             <div className="bg-white p-10 rounded-[48px] shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 border border-emerald-100">
                <div className="text-center md:text-left">
                  <h2 className="text-3xl font-black mb-2 text-emerald-600">AI đã sẵn sàng!</h2>
                  <p className="text-slate-500 font-medium">Vui lòng kiểm tra lại nội dung trước khi xuất bản mã phòng.</p>
                </div>
                <button onClick={saveExamToCloud} className="w-full md:w-auto bg-indigo-600 text-white px-12 py-5 rounded-[28px] font-black text-xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-3">
                  <Save size={24}/> LƯU ĐỀ CLOUD
                </button>
             </div>
             {currentExam.questions.map((q, idx) => (
                <div key={idx} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
                   <p className="font-bold text-lg mb-6 text-slate-800"><span className="text-indigo-600 mr-2">Câu {idx+1}:</span> {q.prompt}</p>
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
        )}

        {mode === AppMode.VIEW_SUBMISSIONS && currentExam && (
          <div className="space-y-8 animate-fade-in pb-20">
             <div className="flex items-center gap-4">
                <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="p-4 bg-white rounded-2xl shadow-sm text-slate-400 hover:text-indigo-600 transition-all border border-slate-100"><ArrowLeft size={24}/></button>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Bảng điểm: {currentExam.title}</h1>
             </div>
             <div className="bg-white rounded-[48px] shadow-xl overflow-hidden border border-slate-100">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-10 py-8">Học sinh</th>
                        <th className="px-10 py-8">Lớp</th>
                        <th className="px-10 py-8 text-center">Kết quả</th>
                        <th className="px-10 py-8 text-center">Thời gian</th>
                        <th className="px-10 py-8 text-right">Ngày thi</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {submissions.filter(s => s.exam_id === currentExam.id).map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                           <td className="px-10 py-7 font-black text-slate-800 text-lg">{s.student_name}</td>
                           <td className="px-10 py-7 font-bold text-slate-500">{s.class_name}</td>
                           <td className="px-10 py-7 text-center font-black text-indigo-600 text-2xl">{s.score} <span className="text-sm text-slate-300">/{s.total}</span></td>
                           <td className="px-10 py-7 text-center font-bold text-slate-400">{formatTime(s.time_spent)}</td>
                           <td className="px-10 py-7 text-right text-slate-400 text-xs font-bold">{new Date(s.submitted_at).toLocaleDateString('vi-VN')}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
                {submissions.filter(s => s.exam_id === currentExam.id).length === 0 && (
                  <div className="p-20 text-center text-slate-400 font-bold">Chưa có học sinh nào nộp bài.</div>
                )}
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
