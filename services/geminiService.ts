
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Nội dung văn bản đề thi:\n\n${text}`,
      config: {
        systemInstruction: `Bạn là chuyên gia bóc tách đề thi tiếng Anh chuyên nghiệp. 
        Nhiệm vụ: Chuyển văn bản thành JSON chứa danh sách câu hỏi.

        QUY TẮC QUAN TRỌNG VỀ ĐÁP ÁN:
        1. Tìm dấu hiệu đáp án đúng: Hãy quét toàn bộ văn bản để tìm đáp án đúng dựa trên:
           - Chữ cái được in đậm hoặc gạch chân trong các lựa chọn.
           - Bảng đáp án (Answer Key) thường nằm ở cuối đề thi.
           - Nếu không có dấu hiệu rõ ràng, hãy dùng kiến thức tiếng Anh của bạn để giải câu hỏi và chọn đáp án đúng nhất.
        2. TUYỆT ĐỐI KHÔNG mặc định chọn đáp án đầu tiên (index 0). Mỗi câu phải có correctAnswerIndex phản ánh đúng kiến thức hoặc dấu hiệu trong đề.

        PHÂN LOẠI CÂU HỎI:
        - 'mcq': Câu hỏi có các lựa chọn A, B, C, D...
        - 'essay': Các câu yêu cầu viết lại câu (Sentence transformation), hoàn thành câu, hoặc viết đoạn văn.

        CẤU TRÚC JSON:
        - 'mcq': Bắt buộc có 'options' (mảng chuỗi) và 'correctAnswerIndex' (0, 1, 2, hoặc 3).
        - 'essay': Phải có 'sampleAnswer' (Đáp án mẫu chuẩn để đối chiếu).
        - 'prompt': Nội dung câu hỏi/yêu cầu.`,
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
    
    return {
      title: result.title || "Đề thi mới",
      questions: (result.questions || []).map((q: any, idx: number) => ({
        ...q,
        id: `q-${idx}-${Date.now()}`
      }))
    };
  } catch (error: any) {
    throw new Error(`AI không thể bóc tách đề: ${error.message}`);
  }
};

/**
 * Hàm mới: Sử dụng AI để chấm điểm phần tự luận của học sinh dựa trên đáp án mẫu
 */
export const gradeEssayWithAI = async (prompt: string, studentAnswer: string, sampleAnswer: string): Promise<number> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Câu hỏi: ${prompt}\nĐáp án mẫu: ${sampleAnswer}\nBài làm của học sinh: ${studentAnswer}`,
      config: {
        systemInstruction: `Bạn là giáo viên chấm thi tiếng Anh. Hãy chấm điểm bài làm của học sinh dựa trên đáp án mẫu.
        - Trả về 1 nếu bài làm đúng ý, ngữ pháp chấp nhận được.
        - Trả về 0.5 nếu đúng một phần hoặc có lỗi ngữ pháp nhỏ.
        - Trả về 0 nếu sai hoàn toàn hoặc để trống.
        Chỉ trả về một con số duy nhất (0, 0.5 hoặc 1).`,
      }
    });
    const score = parseFloat(response.text || "0");
    return isNaN(score) ? 0 : score;
  } catch (e) {
    return 0;
  }
};
