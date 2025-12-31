
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("Vui lòng nhấn nút 'Cấu hình AI Key' ở góc phải màn hình để tiếp tục.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Bạn là chuyên gia khảo thí tiếng Anh. Hãy bóc tách các câu hỏi trắc nghiệm từ văn bản sau.
    Yêu cầu:
    1. Xác định tiêu đề đề thi phù hợp nhất.
    2. Với mỗi câu hỏi: trích xuất nội dung (prompt), 4 lựa chọn (A, B, C, D) và vị trí đáp án đúng (correctAnswerIndex: 0-3).
    3. Luôn trả về định dạng JSON chuẩn.
    
    NỘI DUNG ĐỀ THI:
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
    throw new Error("AI không thể phân tích văn bản này. Vui lòng kiểm tra lại định dạng câu hỏi trong file Word.");
  }
};
