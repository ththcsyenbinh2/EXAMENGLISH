import { GoogleGenAI } from "@google/genai";  // Chỉ import GoogleGenAI
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  // SDK mới tự lấy từ env GEMINI_API_KEY, không cần truyền apiKey
  const ai = new GoogleGenAI({});  

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",  // Model này tồn tại và hỗ trợ tốt structured output
    contents: `Bạn là một chuyên gia khảo thí tiếng Anh cao cấp. Nhiệm vụ của bạn là bóc tách các câu hỏi trắc nghiệm từ văn bản được cung cấp.
    
    Yêu cầu:
    1. Trích xuất tiêu đề đề thi.
    2. Với mỗi câu hỏi: Trích xuất nội dung câu hỏi (prompt), danh sách đúng 4 lựa chọn (options), và chỉ số của đáp án đúng (correctAnswerIndex: từ 0 đến 3).
    3. Trả về đúng định dạng JSON, không kèm bất kỳ giải thích nào.
    
    NỘI DUNG VĂN BẢN:
    ${text}`,
    config: {
      responseMimeType: "application/json",
      // Structured schema trong SDK mới dùng kiểu khác (không có Type)
      responseSchema: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          questions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                prompt: { type: "STRING" },
                options: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                  minItems: 4,
                  maxItems: 4
                },
                correctAnswerIndex: { type: "NUMBER" }  // NUMBER thay vì INTEGER
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
    const resultText = response.text?.();  // Trong SDK mới là response.text()
    const result = JSON.parse(resultText || '{}');
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
