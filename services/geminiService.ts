// geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Nội dung văn bản đề thi:\n\n${text}`,
      config: {
        systemInstruction: `Bạn là một chuyên gia khảo thí tiếng Anh. 
        NHIỆM VỤ: Chuyển văn bản thành JSON đề thi.

        QUY TẮC NHẬN DIỆN ĐÁP ÁN ĐÚNG (MCQ):
        - Ưu tiên tìm ký tự * trước đáp án đúng (ví dụ: *A. Option, hoặc A. *Option, hoặc có * ở bất kỳ vị trí nào gần lựa chọn).
        - Nếu có bảng đáp án (Answer Key) hoặc biểu điểm ở cuối văn bản, hãy sử dụng để lấy correctAnswerIndex chính xác nhất.
        - Nếu không thấy dấu *, hãy kiểm tra in đậm, gạch chân, hoặc ký hiệu (x), (*).
        - Nếu vẫn không có, hãy tự giải câu đố để chọn đáp án đúng nhất. TUYỆT ĐỐI KHÔNG mặc định chọn index 0.

        QUY TẮC TỰ LUẬN (ESSAY):
        - Nhận diện các câu yêu cầu viết lại câu, trả lời câu hỏi, viết đoạn văn.
        - Cung cấp 'sampleAnswer' là đáp án chuẩn nhất, dựa vào biểu điểm nếu có.

        CẤU TRÚC JSON:
        - title: Tiêu đề đề thi.
        - questions: Mảng các đối tượng { type: 'mcq'|'essay', prompt, options (chỉ mcq), correctAnswerIndex (chỉ mcq, 0-3), sampleAnswer (chỉ essay) }.`,
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

export const gradeEssayWithAI = async (prompt: string, studentAnswer: string, sampleAnswer: string): Promise<number> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Câu hỏi: ${prompt}\nĐáp án mẫu: ${sampleAnswer}\nBài làm của học sinh: ${studentAnswer}`,
      config: {
        systemInstruction: `Bạn là giáo viên chấm thi tiếng Anh công bằng. Hãy chấm điểm bài làm của học sinh theo thang 0.0 đến 1.0.
        - Đúng hoàn toàn ý và ngữ pháp: 1.0
        - Đúng hầu hết ý chính, sai ngữ pháp nhẹ: 0.7-0.9
        - Đúng vài ý quan trọng, còn thiếu hoặc sai: 0.3-0.6
        - Sai hoàn toàn hoặc để trống: 0.0
        CHỈ TRẢ VỀ CON SỐ (ví dụ: 0.7). KHÔNG GIẢI THÍCH THÊM.`,
      }
    });
    const score = parseFloat(response.text?.trim() || "0");
    return isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
  } catch (e) {
    return 0;
  }
};
