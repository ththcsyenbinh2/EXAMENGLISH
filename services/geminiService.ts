
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  // Lấy API Key từ môi trường theo đúng quy định
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error("Không tìm thấy cấu hình API_KEY. Vui lòng kiểm tra lại Environment Variables.");
  }

  // Khởi tạo client mới cho mỗi yêu cầu để đảm bảo tính ổn định
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Bạn là một chuyên gia khảo thí tiếng Anh. Hãy bóc tách đề thi sau đây thành cấu trúc JSON.
      
      Yêu cầu nghiêm ngặt:
      1. Tìm tiêu đề của đề thi.
      2. Trích xuất TẤT CẢ các câu hỏi trắc nghiệm.
      3. Với mỗi câu hỏi: Trích xuất nội dung câu hỏi (prompt), 4 lựa chọn (options) và vị trí đáp án đúng (correctAnswerIndex: 0 cho A, 1 cho B, 2 cho C, 3 cho D).
      4. Nếu đề thi không ghi rõ đáp án, hãy sử dụng kiến thức tiếng Anh của bạn để xác định đáp án đúng nhất.
      
      VĂN BẢN ĐỀ THI:
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

    const result = JSON.parse(response.text || '{}');
    return {
      title: result.title || "Đề thi tiếng Anh mới",
      questions: (result.questions || []).map((q: any, idx: number) => ({
        ...q,
        id: `q-${idx}-${Date.now()}`
      }))
    };
  } catch (error: any) {
    console.error("AI Extraction Error:", error);
    throw new Error(`AI không thể bóc tách đề: ${error.message}`);
  }
};
