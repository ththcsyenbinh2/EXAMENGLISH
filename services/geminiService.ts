import { Question } from "../types";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = "gemini-1.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ✅ TIMEOUT HELPER
const fetchWithTimeout = async (promise: Promise<any>, timeoutMs: number = 30000): Promise<any> => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('⏱️ Timeout: AI phản hồi quá lâu (>30s)')), timeoutMs)
    )
  ]);
};

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  if (!GEMINI_API_KEY) {
    throw new Error("❌ Thiếu VITE_GEMINI_API_KEY trong file .env");
  }

  // Giới hạn độ dài
  const maxLength = 10000;
  if (text.length > maxLength) {
    console.warn(`⚠️ Văn bản quá dài (${text.length} ký tự). Cắt xuống ${maxLength} ký tự.`);
    text = text.substring(0, maxLength) + "\n... (đã cắt bớt)";
  }

  console.log('🚀 Đang gửi request đến Gemini API...');
  const startTime = Date.now();

  const systemInstruction = `Bạn là chuyên gia khảo thí tiếng Anh. Chuyển văn bản thành JSON đề thi.

🎯 NHẬN DIỆN ĐÁP ÁN ĐÚNG (MCQ):
1. Text trong **dấu sao đôi** như **A. Answer** → đáp án đúng
2. Text có __gạch dưới__ như __B. Answer__ → đáp án đúng  
3. Có ký hiệu (*A), (*B), (x), [✓] → đáp án đúng
4. Bảng "Answer Key:" ở cuối → ưu tiên dùng
5. Nếu không có dấu hiệu → tự suy luận bằng kiến thức tiếng Anh
6. TUYỆT ĐỐI KHÔNG mặc định chọn A

📝 TỰ LUẬN (ESSAY):
- Nhận diện: "Viết lại câu...", "Trả lời...", "Write about..."
- Lấy "Suggested answer:" hoặc "Sample:" làm sampleAnswer

🔧 JSON OUTPUT:
{
  "title": "Tiêu đề đề thi",
  "questions": [
    {
      "type": "mcq",
      "prompt": "Câu hỏi...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswerIndex": 2
    },
    {
      "type": "essay",
      "prompt": "Viết lại câu...",
      "sampleAnswer": "Đáp án mẫu..."
    }
  ]
}

CHỈ TRẢ VỀ JSON. KHÔNG GIẢI THÍCH.`;

  try {
    const apiCall = fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemInstruction}\n\nNỘI DUNG ĐỀ THI:\n${text}`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8000
        }
      })
    });

    const response = await fetchWithTimeout(apiCall, 30000);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData));
    }

    const data = await response.json();
    const elapsed = Date.now() - startTime;
    console.log(`✅ AI phản hồi sau ${(elapsed / 1000).toFixed(1)}s`);

    // Parse response
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    console.log('🤖 AI Raw Response:', aiText);

    // Loại bỏ markdown code block nếu có
    let cleanJson = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanJson);

    console.log('📦 Parsed JSON:', result);

    const validatedQuestions = (result.questions || []).map((q: any, idx: number) => {
      const validated: any = {
        ...q,
        id: `q-${idx}-${Date.now()}`
      };

      if (q.type === 'mcq') {
        if (q.correctAnswerIndex === undefined || q.correctAnswerIndex === null || 
            typeof q.correctAnswerIndex !== 'number' || q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) {
          console.warn(`⚠️ Câu ${idx+1}: AI không xác định được đáp án. Mặc định = 0`);
          validated.correctAnswerIndex = 0;
        } else {
          validated.correctAnswerIndex = Math.floor(q.correctAnswerIndex);
          console.log(`✅ Câu ${idx+1}: Đáp án đúng = ${String.fromCharCode(65 + validated.correctAnswerIndex)}`);
        }
      }

      return validated;
    });

    return {
      title: result.title || "Đề thi mới",
      questions: validatedQuestions
    };
  } catch (error: any) {
    console.error('❌ Lỗi API:', error);

    if (error.message?.includes('Timeout')) {
      throw new Error(`⏱️ AI phản hồi quá chậm. Thử:\n1. Giảm số câu hỏi\n2. Kiểm tra mạng\n3. Thử lại sau`);
    }

    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key not valid')) {
      throw new Error(`❌ API key không hợp lệ. Tạo key mới tại https://aistudio.google.com/apikey`);
    }

    if (error.message?.includes('quota') || error.message?.includes('429')) {
      throw new Error(`⚠️ Vượt quota API (60/phút hoặc 1500/ngày). Thử lại sau.`);
    }

    throw new Error(`AI lỗi: ${error.message}`);
  }
};

export const gradeEssayWithAI = async (prompt: string, studentAnswer: string, sampleAnswer: string): Promise<number> => {
  if (!GEMINI_API_KEY) {
    console.error("❌ Thiếu API key");
    return 0;
  }

  try {
    const apiCall = fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Bạn là giáo viên tiếng Anh. Chấm điểm thang 1:
- 1 = Đúng hoàn toàn
- 0.5 = Đúng ý nhưng sai ngữ pháp nhẹ
- 0 = Sai hoặc trống

CHỈ TRẢ VỀ SỐ (0, 0.5, hoặc 1). KHÔNG GIẢI THÍCH.

Câu hỏi: ${prompt}
Đáp án mẫu: ${sampleAnswer}
Bài làm: ${studentAnswer}`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 10
        }
      })
    });

    const response = await fetchWithTimeout(apiCall, 10000);
    
    if (!response.ok) {
      console.error('Lỗi chấm essay:', response.status);
      return 0;
    }

    const data = await response.json();
    const scoreText = data.candidates?.[0]?.content?.parts?.[0]?.text || '0';
    const score = parseFloat(scoreText.trim());
    
    return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
  } catch (e: any) {
    console.error("Lỗi chấm essay:", e.message);
    return 0;
  }
};
