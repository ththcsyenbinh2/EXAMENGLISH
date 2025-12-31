
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

const getEnv = (key: string): string => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {}
  return '';
};

const API_KEY = getEnv('API_KEY');

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  if (!API_KEY) {
    throw new Error("Chưa cấu hình Gemini API Key (API_KEY) trên Vercel. Vui lòng vào Settings -> Environment Variables để thêm.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Hãy trích xuất các câu hỏi trắc nghiệm tiếng Anh từ văn bản sau. 
    Văn bản có thể chứa nhiều câu hỏi. Với mỗi câu hỏi, hãy xác định nội dung câu hỏi (prompt), 4 lựa chọn (A, B, C, D) và chỉ số của đáp án đúng (0-3).
    Đồng thời, hãy đề xuất một tiêu đề phù hợp cho đề thi này dựa trên nội dung.
    Lưu ý quan trọng: Chỉ trích xuất các câu hỏi trắc nghiệm thực sự, bỏ qua các đoạn văn bản hướng dẫn không liên quan.
    
    NỘI DUNG VĂN BẢN:
    ${text}`,
    config: {
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
                id: { type: Type.STRING },
                prompt: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  minItems: 4,
                  maxItems: 4
                },
                correctAnswerIndex: { type: Type.INTEGER }
              },
              required: ["id", "prompt", "options", "correctAnswerIndex"]
            }
          }
        },
        required: ["title", "questions"]
      }
    }
  });

  try {
    const result = JSON.parse(response.text || '{}');
    return {
      title: result.title || "Đề thi tiếng Anh mới",
      questions: (result.questions || []).map((q: any, idx: number) => ({
        ...q,
        id: q.id || `q-${idx}-${Date.now()}`
      }))
    };
  } catch (error) {
    throw new Error("AI không thể đọc được cấu trúc đề. Hãy đảm bảo file Word có định dạng câu hỏi rõ ràng.");
  }
};
