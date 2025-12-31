
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Phân tích và số hóa đề thi sau đây.\n\nVĂN BẢN ĐỀ THI:\n${text}`,
      config: {
        systemInstruction: `Bạn là một chuyên gia số hóa đề thi. 
        NHIỆM VỤ CỰC KỲ QUAN TRỌNG: 
        1. Tìm đáp án đúng cho câu hỏi trắc nghiệm (mcq):
           - Hãy quét kỹ các ký tự như dấu sao (*), dấu cộng (+), hoặc các lựa chọn được in đậm/gạch chân trong văn bản. 
           - Nếu một lựa chọn có dấu '*' ở trước hoặc sau (ví dụ: *A. Đáp án hoặc A. Đáp án*), đó CHẮC CHẮN là đáp án đúng.
           - Nếu không có dấu hiệu, hãy tự giải câu hỏi để tìm đáp án logic nhất.
        2. Bóc tách câu hỏi tự luận (essay) và gợi ý đáp án mẫu (sampleAnswer) dựa trên nội dung đề.

        Yêu cầu trả về JSON:
        {
          "title": "Tiêu đề đề thi",
          "questions": [
            {
              "type": "mcq",
              "prompt": "Nội dung câu hỏi",
              "options": ["A...", "B...", "C...", "D..."],
              "correctAnswerIndex": 0-3 (Số nguyên)
            },
            {
              "type": "essay",
              "prompt": "Câu hỏi tự luận",
              "sampleAnswer": "Gợi ý đáp án chi tiết để đối chiếu chấm điểm"
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
      contents: `Câu hỏi: ${prompt}\nĐáp án mẫu: ${sampleAnswer}\nBài làm học sinh: ${studentAnswer}`,
      config: {
        systemInstruction: `Bạn là giáo viên chấm thi tiếng Anh công tâm.
        Hãy chấm điểm bài làm của học sinh trên thang điểm 1.0.
        QUY TẮC CHẤM:
        - Đúng hoàn toàn, hành văn tốt: 1.0
        - Đúng ý chính nhưng sai lỗi nhỏ (ngữ pháp, chính tả): 0.7 - 0.9
        - Đúng được một phần ý hoặc từ khóa quan trọng: 0.3 - 0.6
        - Sai hoàn toàn hoặc không làm: 0.0
        CHỈ TRẢ VỀ DUY NHẤT MỘT CON SỐ (ví dụ: 0.65).`,
      }
    });
    const score = parseFloat(response.text?.trim() || "0");
    return isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
  } catch (e) {
    return 0;
  }
};
