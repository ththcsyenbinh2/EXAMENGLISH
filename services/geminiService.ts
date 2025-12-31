import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  // Fix: Strictly following SDK guidelines to use process.env.API_KEY directly for initialization
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Dưới đây là nội dung văn bản đề thi cần bóc tách:\n\n${text}`,
      config: {
        systemInstruction: `Bạn là một chuyên gia khảo thí tiếng Anh cao cấp. 
        Nhiệm vụ: Bóc tách văn bản thô thành cấu trúc dữ liệu JSON cho ứng dụng thi online.
        
        Quy tắc bóc tách:
        1. Nhận diện tiêu đề đề thi (ví dụ: "Đề kiểm tra giữa học kỳ 1", "English Mock Test").
        2. Tìm tất cả các câu hỏi trắc nghiệm (thường có dạng Câu 1, Question 1... kèm các lựa chọn A, B, C, D).
        3. Với mỗi câu hỏi, trích xuất:
           - prompt: Nội dung câu hỏi.
           - options: Danh sách 4 lựa chọn (loại bỏ các ký tự A., B. ở đầu).
           - correctAnswerIndex: Số nguyên từ 0-3 tương ứng với đáp án đúng (A=0, B=1, C=2, D=3).
        4. Nếu văn bản không chỉ rõ đáp án đúng, hãy dùng kiến thức chuyên gia của bạn để tự giải và điền đáp án chính xác nhất.
        
        Lưu ý: Chỉ trả về JSON, không kèm giải thích.`,
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

    const textOutput = response.text || '{}';
    const result = JSON.parse(textOutput);
    
    return {
      title: result.title || "Đề thi tiếng Anh mới",
      questions: (result.questions || []).map((q: any, idx: number) => ({
        ...q,
        id: `q-${idx}-${Date.now()}`
      }))
    };
  } catch (error: any) {
    console.error("AI Error Details:", error);
    if (error.message?.includes("429")) {
      throw new Error("Tài khoản AI đang hết lượt dùng miễn phí. Thử lại sau vài phút.");
    }
    throw new Error(`AI không thể bóc tách đề: ${error.message || "Lỗi kết nối"}`);
  }
};