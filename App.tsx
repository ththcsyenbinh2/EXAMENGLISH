// ✅ PHẦN CODE ĐÃ SỬA - Chỉ thay thế hàm handleStudentSubmit trong App.tsx của bạn

const handleStudentSubmit = async () => {
  if (!currentExam) return;
  if (!confirm("Xác nhận nộp bài?")) return;

  setIsProcessing(true);
  setLoadingStep('AI đang chấm điểm bài làm...');

  try {
    let mcqScore = 0;
    let essayScore = 0;
    const finalAnswers: Record<string, any> = {};
    
    // ✅ PHẦN QUAN TRỌNG: Chấm điểm từng câu
    for (const q of currentExam.questions) {
      const studentAns = studentAnswers[q.id];
      
      if (q.type === 'mcq') {
        // ✅ ĐÃ SỬA: Đảm bảo cả 2 bên đều là số và so sánh chính xác
        const correctIndex = Number(q.correctAnswerIndex);
        const studentIndex = Number(studentAns);
        
        // Kiểm tra cả 2 đều là số hợp lệ trước khi so sánh
        const isCorrect = !isNaN(studentIndex) && 
                         !isNaN(correctIndex) && 
                         studentIndex === correctIndex;
        
        if (isCorrect) {
          mcqScore++;
        }
        
        // Log để debug (có thể xóa sau khi hoạt động ổn định)
        console.log(`Câu ${q.id}: Học sinh chọn ${studentAns}, Đáp án đúng ${q.correctAnswerIndex}, Kết quả: ${isCorrect ? '✅ Đúng' : '❌ Sai'}`);
        
        finalAnswers[q.id] = { 
          value: studentAns, 
          type: 'mcq',
          isCorrect: isCorrect 
        };
      } else {
        // Chấm tự luận bằng AI
        const score = studentAns ? 
          await gradeEssayWithAI(q.prompt, studentAns, q.sampleAnswer || "") : 0;
        essayScore += score;
        
        finalAnswers[q.id] = { 
          value: studentAns || "", 
          type: 'essay', 
          ai_score: score 
        };
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

    console.log('📊 Kết quả chấm:', {
      trắcNghiệm: mcqScore,
      tựLuận: essayScore.toFixed(1),
      tổng: (mcqScore + essayScore).toFixed(1)
    });

    await supabase.from('submissions').insert([payload]);
    setCurrentSubmission(payload as any);
    setMode(AppMode.STUDENT_RESULT);
  } catch (error: any) {
    alert("Lỗi nộp bài: " + error.message);
    console.error(error);
  } finally {
    setIsProcessing(false);
  }
};
