
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Bạn là một chuyên gia khảo thí tiếng Anh. Hãy bóc tách các câu hỏi trắc nghiệm từ văn bản sau.
    Yêu cầu:
    1. Xác định tiêu đề đề thi.
    2. Với mỗi câu hỏi: trích xuất nội dung (prompt), 4 lựa chọn (options) và vị trí đáp án đúng (correctAnswerIndex từ 0 đến 3).
    3. Trả về định dạng JSON chuẩn.
    
    VĂN BẢN CẦN XỬ LÝ:
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
    throw new Error("AI không thể định dạng được nội dung. Vui lòng kiểm tra lại file Word.");
  }
};
