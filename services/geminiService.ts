
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Nội dung đề thi:\n\n${text}`,
      config: {
        systemInstruction: `Bạn là chuyên gia bóc tách đề thi. 
        Nhiệm vụ: Chuyển văn bản thành JSON chứa danh sách câu hỏi.
        Phân loại câu hỏi:
        - 'mcq': Nếu có các lựa chọn A, B, C, D.
        - 'essay': Nếu là câu hỏi yêu cầu viết lại câu, trả lời câu hỏi, hoặc viết đoạn văn.
        
        Quy tắc:
        1. 'mcq' bắt buộc có 'options' (mảng 4 chuỗi) và 'correctAnswerIndex' (0-3).
        2. 'essay' không có 'options', thay vào đó có 'sampleAnswer' (đáp án mẫu hoặc hướng dẫn chấm).
        3. 'prompt' là nội dung câu hỏi.`,
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
