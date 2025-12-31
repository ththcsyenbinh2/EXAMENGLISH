
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
        - Ưu tiên hàng đầu: Nếu có lựa chọn bắt đầu bằng * hoặc ** (ví dụ: "*A. ..." hoặc "**B. ..."), chọn ngay đó làm đáp án đúng.
        - Nếu không có *, tìm phần Answer Key hoặc đáp án ở cuối đề.
        - Hãy tìm các lựa chọn có dấu hiệu: In đậm, gạch chân, hoặc có ký hiệu (x), (*).
        - Nếu có bảng đáp án (Answer Key) ở cuối văn bản, hãy đối chiếu để lấy correctAnswerIndex.
        - TUYỆT ĐỐI KHÔNG mặc định chọn đáp án đầu tiên (index 0). Nếu không thấy dấu hiệu, hãy tự giải câu đố để chọn đáp án đúng nhất.
        
        QUY TẮC TỰ LUẬN (ESSAY):
        - Nhận diện các câu yêu cầu viết lại câu, trả lời câu hỏi, viết đoạn văn.
        - Cung cấp 'sampleAnswer' là đáp án chuẩn nhất.

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
        systemInstruction: `Bạn là giáo viên chấm thi tiếng Anh. Hãy chấm điểm bài làm của học sinh (thang điểm 1).
        - Trả về 1 nếu đúng hoàn toàn.
        - Trả về 0.5 nếu đúng ý nhưng sai ngữ pháp nhẹ.
        - Trả về 0 nếu sai hoặc để trống.
        CHỈ TRẢ VỀ CON SỐ (0, 0.5, hoặc 1). KHÔNG GIẢI THÍCH THÊM.`,
      }
    });
    const score = parseFloat(response.text?.trim() || "0");
    return isNaN(score) ? 0 : score;
  } catch (e) {
    return 0;
  }
};
