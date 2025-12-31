
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Phân tích văn bản đề thi và bóc tách sang JSON.\n\nVĂN BẢN:\n${text}`,
      config: {
        systemInstruction: `Bạn là một chuyên gia số hóa đề thi. 
        NHIỆM VỤ QUAN TRỌNG NHẤT: Xác định đúng 'correctAnswerIndex'.
        
        QUY TẮC BÓC TÁCH:
        1. Tìm dấu hiệu: In đậm, gạch chân, dấu (*), hoặc bảng đáp án ở cuối đề.
        2. TỰ GIẢI: Nếu không thấy dấu hiệu, bạn BẮT BUỘC phải tự giải câu hỏi để tìm đáp án đúng.
        3. TUYỆT ĐỐI không mặc định chọn A. 
        4. 'correctAnswerIndex' PHẢI là số (0=A, 1=B, 2=C, 3=D).

        Cấu trúc JSON:
        {
          "title": "Tên đề thi",
          "questions": [
            {
              "type": "mcq",
              "prompt": "Câu hỏi...",
              "options": ["A...", "B...", "C...", "D..."],
              "correctAnswerIndex": 0
            },
            {
              "type": "essay",
              "prompt": "Câu hỏi...",
              "sampleAnswer": "Đáp án mẫu..."
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
        correctAnswerIndex: (q.type === 'mcq' && typeof q.correctAnswerIndex !== 'number') ? 0 : q.correctAnswerIndex,
        id: `q-${idx}-${Date.now()}`
      }))
    };
  } catch (error: any) {
    throw new Error(`AI lỗi: ${error.message}`);
  }
};

export const gradeEssayWithAI = async (prompt: string, studentAnswer: string, sampleAnswer: string): Promise<number> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Câu hỏi: ${prompt}\nĐáp án chuẩn: ${sampleAnswer}\nBài làm: ${studentAnswer}`,
      config: {
        systemInstruction: `Chấm điểm tiếng Anh thang điểm 1.0. Trả về duy nhất con số (ví dụ 0.8).`,
      }
    });
    const score = parseFloat(response.text?.trim() || "0");
    return isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
  } catch (e) {
    return 0;
  }
};
