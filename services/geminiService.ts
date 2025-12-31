
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  // Khởi tạo trực tiếp từ process.env.API_KEY theo quy định
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Bạn là một chuyên gia khảo thí tiếng Anh cao cấp. Nhiệm vụ của bạn là bóc tách các câu hỏi trắc nghiệm từ văn bản được cung cấp.
    
    Yêu cầu:
    1. Trích xuất tiêu đề đề thi.
    2. Với mỗi câu hỏi: Trích xuất nội dung câu hỏi (prompt), danh sách 4 lựa chọn (options), và chỉ số của đáp án đúng (correctAnswerIndex: từ 0 đến 3).
    3. Trả về kết quả dưới định dạng JSON duy nhất, không kèm giải thích.
    
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
      title: result.title || "Đề thi tiếng Anh",
      questions: (result.questions || []).map((q: any, idx: number) => ({
        ...q,
        id: `q-${idx}-${Date.now()}`
      }))
    };
  } catch (error) {
    console.error("AI Parsing Error:", error);
    throw new Error("Hệ thống AI không thể xử lý định dạng này. Vui lòng kiểm tra lại file Word.");
  }
};
