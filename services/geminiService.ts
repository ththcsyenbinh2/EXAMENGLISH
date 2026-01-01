import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

// ✅ FIX: Dùng import.meta.env cho Vite
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  if (!GEMINI_API_KEY) {
    throw new Error("Thiếu VITE_GEMINI_API_KEY trong file .env");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Nội dung văn bản đề thi:\n\n${text}`,
      config: {
        systemInstruction: `Bạn là một chuyên gia khảo thí tiếng Anh. 

NHIỆM VỤ: Chuyển văn bản thành JSON đề thi.

QUY TẮC NHẬN DIỆN ĐÁP ÁN ĐÚNG (MCQ):
- Hãy tìm các lựa chọn có dấu hiệu: In đậm, gạch chân, hoặc có ký hiệu (x), (*).
- Nếu có bảng đáp án (Answer Key) ở cuối văn bản, hãy đối chiếu để lấy correctAnswerIndex.
- TUYỆT ĐỐI KHÔNG mặc định chọn đáp án đầu tiên (index 0). Nếu không thấy dấu hiệu, hãy tự giải câu đố để chọn đáp án đúng nhất.
- correctAnswerIndex PHẢI là số nguyên từ 0-3 (0=A, 1=B, 2=C, 3=D).
- Nếu thực sự không xác định được, hãy đọc kỹ câu hỏi và chọn đáp án logic nhất thay vì để 0.

QUY TẮC TỰ LUẬN (ESSAY):
- Nhận diện các câu yêu cầu viết lại câu, trả lời câu hỏi, viết đoạn văn.
- Cung cấp 'sampleAnswer' là đáp án chuẩn nhất.

CẤU TRÚC JSON:
- title: Tiêu đề đề thi.
- questions: Mảng các đối tượng { type: 'mcq'|'essay', prompt, options (chỉ mcq), correctAnswerIndex (chỉ mcq, 0-3), sampleAnswer (chỉ essay) }.`,
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
    
    const result = JSON.parse(response.text || '{}');
    
    // Validate và sửa lỗi dữ liệu từ AI
    const validatedQuestions = (result.questions || []).map((q: any, idx: number) => {
      const validated: any = {
        ...q,
        id: `q-${idx}-${Date.now()}`
      };
      
      // Đảm bảo correctAnswerIndex là số hợp lệ cho MCQ
      if (q.type === 'mcq') {
        if (q.correctAnswerIndex === undefined || q.correctAnswerIndex === null || 
            typeof q.correctAnswerIndex !== 'number' || q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) {
          console.warn(`⚠️ Câu ${idx+1} không có correctAnswerIndex hợp lệ. AI đã trả về: ${q.correctAnswerIndex}. Mặc định = 0.`);
          validated.correctAnswerIndex = 0;
        } else {
          validated.correctAnswerIndex = Math.floor(q.correctAnswerIndex);
        }
      }
      
      return validated;
    });
    
    return {
      title: result.title || "Đề thi mới",
      questions: validatedQuestions
    };
  } catch (error: any) {
    throw new Error(`AI không thể bóc tách đề: ${error.message}`);
  }
};

export const gradeEssayWithAI = async (prompt: string, studentAnswer: string, sampleAnswer: string): Promise<number> => {
  if (!GEMINI_API_KEY) {
    console.error("Thiếu API key, trả về điểm 0");
    return 0;
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Câu hỏi: ${prompt}\nĐáp án mẫu: ${sampleAnswer}\nBài làm của học sinh: ${studentAnswer}`,
      config: {
        systemInstruction: `Bạn là giáo viên chấm thi tiếng Anh. Hãy chấm điểm bài làm của học sinh (thang điểm 1).
- Trả về 1 nếu đúng hoàn toàn.
- Trả về 0.5 nếu đúng ý nhưng sai ngữ pháp nhẹ.
- Trả về 0 nếu sai hoặc để trống.
CHỈ TRẢ VỀ CON SỐ (0, 0.5, hoặc 1). KHÔNG GIẢI THÍCH THÊM.`,
      }
    });
    
    const score = parseFloat(response.text?.trim() || "0");
    return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
  } catch (e) {
    console.error("Lỗi chấm essay:", e);
    return 0;
  }
};
