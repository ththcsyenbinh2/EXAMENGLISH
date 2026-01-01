import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = "gemini-1.5-flash-latest";

// ✅ THÊM: Timeout helper
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

  // ✅ Giới hạn độ dài văn bản (tránh quá tải)
  const maxLength = 10000; // ~10k ký tự
  if (text.length > maxLength) {
    console.warn(`⚠️ Văn bản quá dài (${text.length} ký tự). Cắt xuống ${maxLength} ký tự.`);
    text = text.substring(0, maxLength) + "\n... (đã cắt bớt do quá dài)";
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  console.log('🚀 Đang gửi request đến Gemini API...');
  const startTime = Date.now();
  
  try {
    const apiCall = ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Nội dung văn bản đề thi (có đánh dấu format):\n\n${text}`,
      config: {
        systemInstruction: `Bạn là chuyên gia khảo thí tiếng Anh. Chuyển văn bản thành JSON đề thi.

🎯 NHẬN DIỆN ĐÁP ÁN ĐÚNG (MCQ) - ƯU TIÊN CAO:

1. **Dấu hiệu trong văn bản:**
   - Text trong **dấu sao đôi** như **A. Answer** → đây là đáp án đúng
   - Text có __gạch dưới đôi__ như __B. Answer__ → đây là đáp án đúng
   - Có ký hiệu (*A), (*B), (x), hoặc [✓] trước đáp án → đây là đáp án đúng
   - VD: "(*B) This is correct" hoặc "**C. Correct answer**"

2. **Bảng đáp án (Answer Key):**
   - Nếu văn bản có phần "Answer Key:", "Đáp án:", "KEY:", hãy ưu tiên dùng nó
   - VD: "Answer Key: 1.B 2.C 3.A" → Câu 1 đúng B, Câu 2 đúng C, Câu 3 đúng A

3. **Tự suy luận (nếu không có dấu hiệu):**
   - Đọc câu hỏi và 4 đáp án kỹ
   - Chọn đáp án đúng dựa trên kiến thức tiếng Anh
   - **TUYỆT ĐỐI KHÔNG chọn A mặc định nếu không chắc chắn**

4. **Format correctAnswerIndex:**
   - 0 = A, 1 = B, 2 = C, 3 = D
   - PHẢI là số nguyên 0-3

📝 NHẬN DIỆN TỰ LUẬN (ESSAY):
- Câu hỏi có dạng: "Viết lại câu...", "Trả lời câu hỏi...", "Write about..."
- Cung cấp sampleAnswer là đáp án mẫu tốt nhất
- Nếu văn bản có "Suggested answer:" hoặc "Sample:" → lấy nó làm sampleAnswer

🔧 CẤU TRÚC JSON OUTPUT:
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

⚠️ HÃY XỬ LÝ NHANH: Chỉ trả về JSON, không giải thích thêm!`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['mcq', 'essay'] },
                  prompt: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  correctAnswerIndex: { type: Type.INTEGER },
                  sampleAnswer: { type: Type.STRING }
                },
                required: ["type", "prompt"]
              }
            }
          },
          required: ["title", "questions"]
        }
      }
    });

    // ✅ THÊM TIMEOUT 30 GIÂY
    const response = await fetchWithTimeout(apiCall, 30000);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ AI phản hồi sau ${(elapsed / 1000).toFixed(1)}s`);
    
    const result = JSON.parse(response.text || '{}');
    console.log('🤖 AI Response:', result);
    
    const validatedQuestions = (result.questions || []).map((q: any, idx: number) => {
      const validated: any = {
        ...q,
        id: `q-${idx}-${Date.now()}`
      };
      
      if (q.type === 'mcq') {
        if (q.correctAnswerIndex === undefined || q.correctAnswerIndex === null || 
            typeof q.correctAnswerIndex !== 'number' || q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) {
          console.warn(`⚠️ Câu ${idx+1}: AI không xác định được đáp án. Trả về: ${q.correctAnswerIndex}. Mặc định = 0`);
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
      throw new Error(`⏱️ AI phản hồi quá chậm. Thử:\n1. Giảm số câu hỏi trong file Word\n2. Kiểm tra kết nối mạng\n3. Thử lại sau vài phút`);
    }
    
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('expired')) {
      throw new Error(`❌ API key không hợp lệ. Tạo key mới tại https://aistudio.google.com/apikey`);
    }
    
    if (error.message?.includes('quota') || error.message?.includes('limit')) {
      throw new Error(`⚠️ Đã vượt quota API (60 requests/phút hoặc 1500/ngày). Vui lòng thử lại sau.`);
    }
    
    throw new Error(`AI lỗi: ${error.message}`);
  }
};

export const gradeEssayWithAI = async (prompt: string, studentAnswer: string, sampleAnswer: string): Promise<number> => {
  if (!GEMINI_API_KEY) {
    console.error("❌ Thiếu API key");
    return 0;
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  try {
    const apiCall = ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Câu hỏi: ${prompt}\nĐáp án mẫu: ${sampleAnswer}\nBài làm: ${studentAnswer}`,
      config: {
        systemInstruction: `Bạn là giáo viên tiếng Anh. Chấm điểm thang 1:
- 1 = Đúng hoàn toàn
- 0.5 = Đúng ý nhưng sai ngữ pháp nhẹ
- 0 = Sai hoặc trống
CHỈ TRẢ VỀ SỐ (0, 0.5, hoặc 1). KHÔNG GIẢI THÍCH.`,
      }
    });
    
    // ✅ TIMEOUT 10 GIÂY CHO CHẤM ESSAY
    const response = await fetchWithTimeout(apiCall, 10000);
    
    const score = parseFloat(response.text?.trim() || "0");
    return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
  } catch (e: any) {
    console.error("Lỗi chấm essay:", e.message);
    // Nếu timeout, trả về 0 thay vì crash
    return 0;
  }
};
