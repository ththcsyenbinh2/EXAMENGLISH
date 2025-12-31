
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Phân tích văn bản đề thi tiếng Anh sau và chuyển sang JSON.\n\nVĂN BẢN ĐỀ THI:\n${text}`,
      config: {
        systemInstruction: `Bạn là chuyên gia số hóa đề thi. 
        NHIỆM VỤ QUAN TRỌNG NHẤT: Xác định đúng đáp án trắc nghiệm (correctAnswerIndex).
        
        QUY TẮC BÓC TÁCH ĐÁP ÁN:
        1. Tìm dấu hiệu trực tiếp: Đáp án có dấu *, có chữ in đậm, gạch chân hoặc được khoanh tròn (A, B, C, D).
        2. Tìm bảng đáp án: Nếu cuối văn bản có "Answer Key" hoặc "Bảng đáp án", hãy đối chiếu mã câu hỏi.
        3. TỰ GIẢI (BẮT BUỘC): Nếu không có dấu hiệu, bạn PHẢI TỰ GIẢI câu hỏi đó. 
        4. KHÔNG ĐƯỢC MẶC ĐỊNH CHỌN A (index 0). Nếu bạn không chắc chắn, hãy phân tích ngữ pháp/từ vựng để tìm đáp án đúng nhất.
        5. 'correctAnswerIndex' phải là số nguyên từ 0 đến 3 (0=A, 1=B, 2=C, 3=D).

        Cấu trúc JSON:
        {
          "title": "Tiêu đề đề thi",
          "questions": [
            {
              "type": "mcq",
              "prompt": "Nội dung câu hỏi",
              "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
              "correctAnswerIndex": 0-3
            },
            {
              "type": "essay",
              "prompt": "Nội dung câu hỏi",
              "sampleAnswer": "Đáp án mẫu hoàn chỉnh nhất"
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
        // Đảm bảo correctAnswerIndex luôn là number
        correctAnswerIndex: typeof q.correctAnswerIndex === 'number' ? q.correctAnswerIndex : 0,
        id: `q-${idx}-${Date.now()}`
      }))
    };
  } catch (error: any) {
    throw new Error(`Lỗi AI: ${error.message}`);
  }
};

export const gradeEssayWithAI = async (prompt: string, studentAnswer: string, sampleAnswer: string): Promise<number> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Câu hỏi: ${prompt}\nĐáp án chuẩn: ${sampleAnswer}\nBài làm: ${studentAnswer}`,
      config: {
        systemInstruction: `Bạn là giáo viên chấm thi tiếng Anh cực kỳ chính xác.
        Hãy chấm bài làm của học sinh trên thang điểm 1.0 dựa trên đáp án chuẩn.
        - Đúng hoàn toàn: 1.0
        - Đúng nghĩa nhưng sai lỗi vặt (viết hoa, dấu câu): 0.9
        - Đúng nghĩa nhưng sai ngữ pháp nhẹ: 0.7
        - Đúng 50% ý: 0.5
        - Sai hoàn toàn hoặc không làm: 0.0
        TRẢ VỀ CHỈ DUY NHẤT CON SỐ (ví dụ: 0.7).`,
      }
    });
    const score = parseFloat(response.text?.trim() || "0");
    return isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
  } catch (e) {
    return 0;
  }
};
