
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Phân tích văn bản đề thi sau và bóc tách thành JSON chuẩn.\n\nVĂN BẢN:\n${text}`,
      config: {
        systemInstruction: `Bạn là một trợ lý số hóa đề thi chuyên nghiệp.
        
        NHIỆM VỤ QUAN TRỌNG: Xác định đáp án đúng (correctAnswerIndex) cho các câu hỏi trắc nghiệm (mcq).
        
        QUY TẮC BÓC TÁCH ĐÁP ÁN:
        1. Tìm dấu hiệu: Chữ in đậm, gạch chân, dấu (*), hoặc phần 'Answer Key' ở cuối file.
        2. TỰ GIẢI ĐỀ: Nếu file Word KHÔNG CÓ bất kỳ dấu hiệu nào chỉ ra đáp án đúng, bạn BẮT BUỘC phải vận dụng kiến thức tiếng Anh/kiến thức tổng hợp để TỰ GIẢI và tìm ra đáp án đúng nhất (A, B, C hoặc D).
        3. TUYỆT ĐỐI KHÔNG mặc định chọn đáp án A (index 0). Nếu bạn mặc định chọn A cho tất cả các câu, hệ thống sẽ bị lỗi.
        4. 'correctAnswerIndex' phải là số nguyên: 0 cho A, 1 cho B, 2 cho C, 3 cho D.

        ĐỊNH DẠNG JSON:
        {
          "title": "Tiêu đề đề thi",
          "questions": [
            {
              "type": "mcq",
              "prompt": "Câu hỏi...",
              "options": ["A...", "B...", "C...", "D..."],
              "correctAnswerIndex": 0-3
            },
            {
              "type": "essay",
              "prompt": "Câu hỏi...",
              "sampleAnswer": "Đáp án mẫu hoàn chỉnh"
            }
          ]
        }`,
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
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
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
    throw new Error(`Lỗi AI bóc tách: ${error.message}`);
  }
};

export const gradeEssayWithAI = async (prompt: string, studentAnswer: string, sampleAnswer: string): Promise<number> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Câu: ${prompt}\nChuẩn: ${sampleAnswer}\nTrò: ${studentAnswer}`,
      config: {
        systemInstruction: `Chấm điểm tiếng Anh thang 1.0. Trả về duy nhất con số (VD: 0.9).`,
      }
    });
    const score = parseFloat(response.text?.trim() || "0");
    return isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
  } catch (e) {
    return 0;
  }
};
