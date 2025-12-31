
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  // Khởi tạo AI ngay trong hàm để luôn lấy API_KEY mới nhất từ môi trường
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Bạn là trợ lý giáo dục chuyên nghiệp. Hãy bóc tách các câu hỏi trắc nghiệm tiếng Anh từ văn bản sau.
    Yêu cầu:
    1. Trích xuất tiêu đề đề thi phù hợp.
    2. Với mỗi câu hỏi: nội dung (prompt), 4 lựa chọn (options) và vị trí đáp án đúng (correctAnswerIndex: 0-3).
    3. Trả về định dạng JSON.
    
    NỘI DUNG:
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
                prompt: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  minItems: 4,
                  maxItems: 4
                },
                correctAnswerIndex: { type: Type.INTEGER }
              },
              required: ["prompt", "options", "correctAnswerIndex"]
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
        id: `q-${idx}-${Date.now()}`
      }))
    };
  } catch (error) {
    throw new Error("AI không thể đọc được cấu trúc đề thi. Vui lòng kiểm tra lại định dạng file Word.");
  }
};
