
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API_KEY chưa được thiết lập. Vui lòng kiểm tra Environment Variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Bạn là chuyên gia khảo thí tiếng Anh. Hãy bóc tách các câu hỏi trắc nghiệm từ văn bản sau.
    Yêu cầu:
    1. Xác định tiêu đề đề thi.
    2. Với mỗi câu hỏi: trích xuất nội dung, 4 lựa chọn (A, B, C, D) và vị trí đáp án đúng (0-3).
    3. Trả về định dạng JSON chuẩn.
    
    VĂN BẢN:
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
      title: result.title || "Đề thi mới",
      questions: (result.questions || []).map((q: any, idx: number) => ({
        ...q,
        id: `q-${idx}-${Date.now()}`
      }))
    };
  } catch (error) {
    throw new Error("AI không thể phân tích văn bản này. Hãy kiểm tra lại file Word.");
  }
};
