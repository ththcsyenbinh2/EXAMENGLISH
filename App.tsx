
import React, { useState, useEffect, useMemo } from 'react';
import { AppMode, Exam, Question, StudentSubmission } from './types';
import { extractQuestionsFromText } from './services/geminiService';
import { supabase } from './services/supabase';
import { 
  GraduationCap, Plus, Share2, ChevronRight, Loader2, Trash2, 
  Trophy, Clock, Send, Users, ArrowLeft, Download, Database,
  Lock, Unlock, Search, UserCircle, School, BarChart3, PieChart,
  UserCheck, AlertTriangle, TrendingUp
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
    fetchExams();
    if (window.location.hash === '#hocsinh') {
      setMode(AppMode.STUDENT_ENTRY);
    }
  }, []);

  useEffect(() => {
    let interval: any;
    if (mode === AppMode.STUDENT_EXAM) {
      interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [mode]);

  const fetchExams = async () => {
    setIsDbLoading(true);
    try {
      const { data: exData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      if (exData) setExams(exData);
      const { data: subData } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
      if (subData) setSubmissions(subData);
    } catch (e) {
      console.error("Database connection error:", e);
    } finally {
      setIsDbLoading(false);
    }
  };

  const classStats = useMemo(() => {
    if (!currentExam) return [];
    const examSubmissions = submissions.filter(s => (s as any).exam_id === currentExam.id);
    
    const statsMap: Record<string, { 
      className: string, 
      count: number, 
      totalScore: number, 
      maxScore: number,
      minScore: number,
      students: any[]
    }> = {};

    examSubmissions.forEach((s: any) => {
      const cls = s.class_name || "Chưa phân lớp";
      if (!statsMap[cls]) {
        statsMap[cls] = { className: cls, count: 0, totalScore: 0, maxScore: 0, minScore: s.total, students: [] };
      }
      statsMap[cls].count++;
      statsMap[cls].totalScore += s.score;
      statsMap[cls].maxScore = Math.max(statsMap[cls].maxScore, s.score);
      statsMap[cls].minScore = Math.min(statsMap[cls].minScore, s.score);
      statsMap[cls].students.push(s);
    });

    return Object.values(statsMap).sort((a, b) => a.className.localeCompare(b.className));
  }, [submissions, currentExam]);

  const generateExamCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setLoadingStep('Đang đọc file Word...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      setLoadingStep('AI đang bóc tách câu hỏi...');
      const extracted = await extractQuestionsFromText(result.value);
      const newExam: Exam = {
        id: Math.random().toString(36).substr(2, 9),
        exam_code: generateExamCode(),
        title: extracted.title,
        description: `Tạo từ ${file.name}`,
        questions: extracted.questions,
        is_open: false,
        created_at: new Date().toISOString()
      };
      setCurrentExam(newExam);
      setMode(AppMode.EXAM_SETUP);
    } catch (error: any) {
      alert(`Lỗi: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveExamToDb = async () => {
    if (!currentExam) return;
    setIsDbLoading(true);
    const { error } = await supabase.from('exams').insert([currentExam]);
    if (error) alert(error.message);
    else {
      await fetchExams();
      setMode(AppMode.TEACHER_DASHBOARD);
    }
    setIsDbLoading(false);
  };

  const toggleExamStatus = async (exam: Exam) => {
    setIsDbLoading(true);
    const { error } = await supabase.from('exams').update({ is_open: !exam.is_open }).eq('id', exam.id);
    if (!error) await fetchExams();
    setIsDbLoading(false);
  };

  const validateAndJoinExam = async () => {
    if (!studentName || !className || !examCodeInput) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }
    setIsDbLoading(true);
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('exam_code', examCodeInput.toUpperCase())
      .single();

    if (error || !data) {
      alert("Mã đề không tồn tại!");
    } else if (!data.is_open) {
      alert("Đề thi này hiện đang ĐÓNG. Vui lòng liên hệ giáo viên!");
    } else {
      setCurrentExam(data);
      setStudentAnswers({});
      setTimer(0);
      setMode(AppMode.STUDENT_EXAM);
    }
    setIsDbLoading(false);
  };

  const submitExam = async () => {
    if (!currentExam) return;
    let score = 0;
    currentExam.questions.forEach(q => {
      if (studentAnswers[q.id] === q.correctAnswerIndex) score++;
    });

    const submission = {
      exam_id: currentExam.id,
      student_name: studentName,
      class_name: className,
      answers: studentAnswers,
      score,
      total: currentExam.questions.length,
      time_spent: timer
    };

    setIsDbLoading(true);
    const { data, error } = await supabase.from('submissions').insert([submission]).select().single();
    if (!error) {
      setCurrentSubmission({
        ...data,
        examId: data.exam_id,
        studentName: data.student_name,
        className: data.class_name,
        timeSpent: data.time_spent,
        submittedAt: Date.parse(data.submitted_at),
        total: data.total
      });
      setMode(AppMode.STUDENT_RESULT);
    }
    setIsDbLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderTeacherDashboard = () => (
    <div className="max-w-6xl mx-auto p-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Quản lý Đề thi</h1>
          <p className="text-slate-500 font-medium">Theo dõi hoạt động và kết quả học tập của học sinh.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => { window.location.hash = 'hocsinh'; setMode(AppMode.STUDENT_ENTRY); }}
            className="bg-white text-slate-600 border border-slate-200 px-6 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <UserCircle className="w-5 h-5"/>
            Chế độ Học sinh
          </button>
          <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-100 active:scale-95 transition-all">
            <Plus className="w-5 h-5" />
            <span>Tạo Đề Mới</span>
            <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {exams.map(exam => {
          const count = submissions.filter(s => (s as any).exam_id === exam.id).length;
          return (
            <div key={exam.id} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
              <div className={`absolute top-0 left-0 w-full h-1.5 ${exam.is_open ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
              <div className="flex justify-between items-start mb-6">
                 <div className="bg-slate-100 px-3 py-1.5 rounded-xl font-black text-indigo-600 text-sm tracking-wider">
                   MÃ: {exam.exam_code}
                 </div>
                 <button 
                   onClick={() => toggleExamStatus(exam)}
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                     exam.is_open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                   }`}
                 >
                   {exam.is_open ? <Unlock className="w-3 h-3"/> : <Lock className="w-3 h-3"/>}
                   {exam.is_open ? 'ĐANG MỞ' : 'ĐANG ĐÓNG'}
                 </button>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-6 line-clamp-1">{exam.title}</h3>
              <div className="flex items-center gap-6 mb-8">
                 <div className="flex flex-col">
                   <span className="text-2xl font-black text-slate-900">{count}</span>
                   <span className="text-[10px] font-black text-slate-400 uppercase">Lượt thi</span>
                 </div>
                 <div className="w-px h-8 bg-slate-100"></div>
                 <div className="flex flex-col">
                   <span className="text-2xl font-black text-slate-900">{exam.questions.length}</span>
                   <span className="text-[10px] font-black text-slate-400 uppercase">Câu hỏi</span>
                 </div>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={() => { setCurrentExam(exam); setMode(AppMode.VIEW_SUBMISSIONS); }}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl text-sm font-black transition-all shadow-md shadow-indigo-50"
                >
                  <BarChart3 className="w-4 h-4" /> Xem Thống Kê
                </button>
                <div className="flex gap-2">
                   <button 
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}#hocsinh`;
                      navigator.clipboard.writeText(url);
                      alert("Gửi link này cho học sinh và cấp Mã đề: " + exam.exam_code);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-50 text-slate-600 py-3.5 rounded-xl text-sm font-bold border border-slate-100"
                   >
                     <Share2 className="w-4 h-4" /> Gửi Link
                   </button>
                   <button 
                     onClick={() => {
                      if (confirm("Xóa đề này và toàn bộ kết quả liên quan?")) {
                        supabase.from('exams').delete().eq('id', exam.id).then(() => fetchExams());
                      }
                     }}
                     className="p-3.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 border border-red-100"
                   >
                     <Trash2 className="w-4 h-4"/>
                   </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderViewSubmissions = () => {
    const examSubmissions = submissions.filter(s => (s as any).exam_id === currentExam?.id);
    const avgScore = examSubmissions.length > 0 
      ? (examSubmissions.reduce((acc, s) => acc + (s as any).score, 0) / examSubmissions.length).toFixed(1)
      : 0;

    return (
      <div className="max-w-6xl mx-auto p-6 animate-fade-in">
        <button onClick={() => setMode(AppMode.TEACHER_DASHBOARD)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold mb-8 transition-colors">
          <ArrowLeft className="w-5 h-5" /> Quay lại Dashboard
        </button>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4"><Users className="w-6 h-6"/></div>
            <div className="text-3xl font-black text-slate-900">{examSubmissions.length}</div>
            <div className="text-xs font-black text-slate-400 uppercase mt-1">Tổng học sinh thi</div>
          </div>
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4"><TrendingUp className="w-6 h-6"/></div>
            <div className="text-3xl font-black text-slate-900">{avgScore}</div>
            <div className="text-xs font-black text-slate-400 uppercase mt-1">Điểm trung bình</div>
          </div>
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-4"><School className="w-6 h-6"/></div>
            <div className="text-3xl font-black text-slate-900">{classStats.length}</div>
            <div className="text-xs font-black text-slate-400 uppercase mt-1">Số lớp tham gia</div>
          </div>
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4"><PieChart className="w-6 h-6"/></div>
            <div className="text-3xl font-black text-slate-900">
              {Math.round((examSubmissions.filter(s => (s as any).score >= (s as any).total / 2).length / (examSubmissions.length || 1)) * 100)}%
            </div>
            {/* Fix: Escape special character >= by wrapping it in curly braces and a string */}
            <div className="text-xs font-black text-slate-400 uppercase mt-1">{"Tỉ lệ đạt (>=5)"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-6">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-600"/> Thống kê theo lớp
            </h3>
            {classStats.map(stat => (
              <div key={stat.className} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all cursor-default">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-black text-indigo-600">Lớp {stat.className}</span>
                  <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{stat.count} bạn thi</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <div className="text-xs font-black text-slate-400 uppercase mb-1">TB Lớp</div>
                    <div className="text-xl font-black text-slate-900">{(stat.totalScore / stat.count).toFixed(1)}</div>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-2xl">
                    <div className="text-xs font-black text-indigo-400 uppercase mb-1">Cao nhất</div>
                    <div className="text-xl font-black text-indigo-600">{stat.maxScore}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 min-h-full">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black text-slate-900">Danh sách bài nộp</h3>
                <button className="text-indigo-600 font-bold text-sm flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl">
                  <Download className="w-4 h-4"/> Xuất Excel
                </button>
              </div>
              <div className="space-y-4">
                {examSubmissions.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl group hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-all border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-indigo-600 shadow-sm border border-slate-100">{s.student_name.charAt(0)}</div>
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{s.student_name}</div>
                        <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
                          <School className="w-3 h-3"/> Lớp {s.class_name} • <Clock className="w-3 h-3"/> {formatTime(s.time_spent)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="text-xl font-black text-slate-900">{s.score}<span className="text-slate-300 text-sm font-bold">/{s.total}</span></div>
                       <div className="text-[10px] font-black text-slate-400 uppercase">{new Date(s.submitted_at).toLocaleTimeString('vi-VN')}</div>
                    </div>
                  </div>
                ))}
                {examSubmissions.length === 0 && (
                  <div className="text-center py-20">
                    <AlertTriangle className="w-12 h-12 text-slate-200 mx-auto mb-4"/>
                    <p className="text-slate-400 font-bold">Chưa có học sinh nào nộp bài.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStudentEntry = () => (
    <div className="max-w-xl mx-auto p-6 py-10 animate-fade-in">
      <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16"></div>
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-200 relative z-10">
          <GraduationCap className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 text-center mb-10 relative z-10">Cổng Thi Trực Tuyến</h1>
        
        <div className="space-y-6 mb-10 relative z-10">
          <div>
            <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">
              <UserCircle className="w-4 h-4"/> Họ và tên
            </label>
            <input 
              type="text" 
              placeholder="Nhập họ và tên..."
              className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">
              <School className="w-4 h-4"/> Lớp học
            </label>
            <input 
              type="text" 
              placeholder="Ví dụ: 12A1, 11B2..."
              className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold outline-none"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">
              <Search className="w-4 h-4"/> Mã đề thi (6 ký tự)
            </label>
            <input 
              type="text" 
              placeholder="NHẬP MÃ"
              className="w-full p-5 rounded-2xl bg-indigo-50 border-2 border-indigo-100 focus:border-indigo-600 focus:bg-white transition-all font-black text-indigo-600 text-center uppercase tracking-[0.5em] outline-none text-2xl"
              value={examCodeInput}
              maxLength={6}
              onChange={(e) => setExamCodeInput(e.target.value)}
            />
          </div>
        </div>

        <button 
          onClick={validateAndJoinExam}
          disabled={isDbLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-[24px] font-black text-xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 disabled:opacity-50 transition-all transform active:scale-95"
        >
          {isDbLoading ? <Loader2 className="animate-spin w-6 h-6"/> : <>VÀO THI NGAY <ChevronRight className="w-6 h-6" /></>}
        </button>
        <p className="mt-8 text-slate-400 text-[10px] text-center font-black uppercase tracking-widest">Hệ thống lưu trữ Cloud v2.5</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFF]">
      <header className="bg-white/90 border-b border-slate-100 py-4 px-6 sticky top-0 z-[100] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { window.location.hash = ''; setMode(AppMode.TEACHER_DASHBOARD); }}>
            <div className="bg-indigo-600 p-2.5 rounded-[14px] shadow-md shadow-indigo-100"><GraduationCap className="text-white w-6 h-6" /></div>
            <span className="font-black text-slate-900 text-2xl tracking-tighter">SmartEnglish</span>
          </div>
          <div className="flex items-center gap-4">
             {isDbLoading && <Loader2 className="animate-spin text-indigo-600 w-5 h-5"/>}
             <div className="hidden sm:block text-right">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Dữ liệu Cloud</div>
                <div className="text-sm font-bold text-slate-900">{mode === AppMode.TEACHER_DASHBOARD ? 'Giáo viên' : 'Cổng học sinh'}</div>
             </div>
          </div>
        </div>
      </header>

      <main className="py-8">
        {isProcessing && (
          <div className="max-w-2xl mx-auto p-12 bg-white rounded-[40px] text-center shadow-xl mb-8 animate-pulse border border-indigo-50">
            <Loader2 className="animate-spin w-16 h-16 text-indigo-600 mx-auto mb-6"/>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{loadingStep}</h2>
            <p className="text-slate-400 font-medium">AI đang xử lý tài liệu Word của bạn...</p>
          </div>
        )}

        {mode === AppMode.TEACHER_DASHBOARD && renderTeacherDashboard()}
        {mode === AppMode.STUDENT_ENTRY && renderStudentEntry()}
        {mode === AppMode.VIEW_SUBMISSIONS && renderViewSubmissions()}
        
        {mode === AppMode.EXAM_SETUP && currentExam && (
          <div className="max-w-4xl mx-auto p-6 animate-fade-in">
             <div className="bg-white p-8 rounded-[32px] shadow-sm flex justify-between items-center mb-8 border border-slate-100">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 mb-1">Xem trước đề thi</h2>
                  <p className="text-slate-500 font-medium">Vui lòng kiểm tra lại nội dung trước khi xuất bản.</p>
                </div>
                <button 
                  onClick={saveExamToDb} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-lg shadow-indigo-50 transition-all flex items-center gap-2"
                >
                  <Database className="w-5 h-5"/> Lưu Đề Thi
                </button>
             </div>
             <div className="space-y-6">
                {currentExam.questions.map((q, idx) => (
                  <div key={q.id} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <div className="flex gap-4 mb-6">
                      <span className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black flex-shrink-0">{idx+1}</span>
                      <p className="text-lg font-bold text-slate-800 pt-1.5">{q.prompt}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-0 md:ml-14">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className={`p-4 rounded-2xl border-2 flex items-center gap-3 ${oIdx === q.correctAnswerIndex ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'bg-slate-50 border-transparent text-slate-600 font-medium'}`}>
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${oIdx === q.correctAnswerIndex ? 'bg-emerald-500 text-white' : 'bg-white'}`}>
                            {String.fromCharCode(65+oIdx)}
                          </span>
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {mode === AppMode.STUDENT_EXAM && (
          <div className="max-w-4xl mx-auto p-6 animate-fade-in">
            <div className="bg-white p-8 rounded-[32px] shadow-sm mb-8 border border-slate-100 flex justify-between items-center sticky top-24 z-50">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-100">{currentExam?.questions.length}</div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 leading-tight">{currentExam?.title}</h2>
                    <p className="text-indigo-600 font-black text-sm uppercase tracking-wider">{studentName} - Lớp {className}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-indigo-50 px-6 py-4 rounded-[24px] border border-indigo-100">
                  <Clock className="w-6 h-6 text-indigo-600"/>
                  <span className="text-3xl font-black text-indigo-600 tabular-nums">{formatTime(timer)}</span>
                </div>
            </div>
            
            <div className="space-y-8">
              {currentExam?.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                  <h3 className="text-xl font-bold mb-8 flex gap-5">
                    <span className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black flex-shrink-0 shadow-lg">{idx+1}</span>
                    <span className="mt-2 text-slate-800 leading-relaxed">{q.prompt}</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-0 md:ml-16">
                    {q.options.map((opt, oIdx) => (
                      <button 
                        key={oIdx} 
                        onClick={() => setStudentAnswers({...studentAnswers, [q.id]: oIdx})}
                        className={`p-5 rounded-2xl border-2 text-left font-bold transition-all flex items-center gap-4 ${
                          studentAnswers[q.id] === oIdx 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 transform -translate-y-1' 
                          : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'
                        }`}
                      >
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${studentAnswers[q.id] === oIdx ? 'bg-white/20' : 'bg-slate-100'}`}>
                          {String.fromCharCode(65+oIdx)}
                        </span>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 p-10 bg-white rounded-[40px] shadow-lg border border-slate-100 text-center">
               <p className="text-slate-400 font-bold mb-8 flex items-center justify-center gap-2">
                 <CheckCircle2 className="w-5 h-5 text-emerald-500"/> Chúc bạn hoàn thành bài thi tốt nhất!
               </p>
               <button 
                 onClick={() => { if(confirm("Xác nhận nộp bài?")) submitExam(); }} 
                 className="w-full max-w-md bg-indigo-600 text-white py-6 rounded-[24px] font-black text-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
               >
                 NỘP BÀI NGAY
               </button>
            </div>
          </div>
        )}

        {mode === AppMode.STUDENT_RESULT && currentSubmission && (
          <div className="max-w-xl mx-auto p-12 bg-white rounded-[56px] shadow-2xl text-center animate-fade-in border border-slate-50 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
             <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner">
               <Trophy className="w-12 h-12"/>
             </div>
             <h2 className="text-4xl font-black text-slate-900 mb-2">Đã Lưu Điểm!</h2>
             <p className="text-slate-500 mb-10 font-bold uppercase tracking-wider text-xs">Chúc mừng {studentName} hoàn thành bài thi.</p>
             
             <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-indigo-50 p-8 rounded-[32px] border border-indigo-100">
                   <div className="text-5xl font-black text-indigo-600">{currentSubmission.score}</div>
                   <div className="text-[10px] font-black text-indigo-400 uppercase mt-2 tracking-widest">Câu đúng</div>
                </div>
                <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                   <div className="text-5xl font-black text-slate-600">{formatTime(currentSubmission.timeSpent)}</div>
                   <div className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">Thời gian</div>
                </div>
             </div>

             <button 
              onClick={() => { window.location.hash = ''; setMode(AppMode.TEACHER_DASHBOARD); }} 
              className="bg-slate-900 text-white w-full py-5 rounded-[24px] font-black text-lg transition-all hover:bg-black shadow-xl flex items-center justify-center gap-2"
             >
               Về Trang Chủ <ArrowLeft className="w-5 h-5"/>
             </button>
          </div>
        )}
      </main>
    </div>
  );
};

// Helper components defined clearly
const CheckCircle2 = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
);

export default App;
