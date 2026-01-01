
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
NHẬN DIỆN ĐÁP ÁN ĐÚNG (MCQ) - ƯU TIÊN CAO:
1. **Dấu hiệu trong văn bản:**
   - Text trong **dấu sao đôi** như **A. Answer** → đây là đáp án đúng
   - Text có __gạch dưới đôi__ như __B. Answer__ → đây là đáp án đúng
   - Có ký hiệu (*A), (*B), (x), hoặc [✓] trước đáp án → đây là đáp án đúng
   - VD: "(*B) This is correct" hoặc "**C. Correct answer**"
2. **Bảng đáp án (Answer Key):**
   - Nếu văn bản có phần "Answer Key:", "Đáp án:", "KEY:", hãy ưu tiên dùng nó
   - VD: "Answer Key: 1.B 2.C 3.A" → Câu 1 đúng B, Câu 2 đúng C, Câu 3 đúng A
3. **Tự suy luận (nếu không có dấu hiệu):**
   - Đọc câu hỏi và 4 đáp án kỹ
   - Chọn đáp án đúng dựa trên kiến thức tiếng Anh
   - **TUYỆT ĐỐI KHÔNG chọn A mặc định nếu không chắc chắn**
4. **Format correctAnswerIndex:**
   - 0 = A, 1 = B, 2 = C, 3 = D
   - PHẢI là số nguyên 0-3
NHẬN DIỆN TỰ LUẬN (ESSAY):
- Câu hỏi có dạng: "Viết lại câu...", "Trả lời câu hỏi...", "Write about..."
- Cung cấp sampleAnswer là đáp án mẫu tốt nhất
- Nếu văn bản có "Suggested answer:" hoặc "Sample:" → lấy nó làm sampleAnswer

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
