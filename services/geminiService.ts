
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Dưới đây là nội dung văn bản bóc tách từ file đề thi Word. Hãy phân tích và chuyển nó sang định dạng JSON.\n\nNỘI DUNG VĂN BẢN:\n${text}`,
      config: {
        systemInstruction: `Bạn là một chuyên gia khảo thí và bóc tách dữ liệu đề thi tiếng Anh chuyên nghiệp.
        
        NHIỆM VỤ:
        1. Xác định tiêu đề đề thi.
        2. Bóc tách từng câu hỏi (Trắc nghiệm MCQ hoặc Tự luận Essay).
        
        QUY TẮC VỀ ĐÁP ÁN TRẮC NGHIỆM (QUAN TRỌNG):
        - TUYỆT ĐỐI KHÔNG mặc định chọn đáp án A (index 0).
        - Tìm các dấu hiệu đáp án đúng: Chữ cái được khoanh tròn, in đậm (bold), gạch chân (underline), hoặc có dấu hiệu (*), (x) bên cạnh.
        - Nếu văn bản có phần "ANSWER KEY" hoặc "BẢNG ĐÁP ÁN" ở cuối, hãy đối chiếu mã câu hỏi để lấy đáp án chính xác.
        - Nếu KHÔNG CÓ bất kỳ dấu hiệu nào, bạn phải TỰ GIẢI câu hỏi đó dựa trên kiến thức tiếng Anh để chọn ra đáp án đúng nhất (A, B, C hoặc D) và gán vào 'correctAnswerIndex'.

        QUY TẮC TỰ LUẬN:
        - Với các câu viết lại, điền từ, trả lời câu hỏi... hãy gán type là 'essay'.
        - Luôn tạo 'sampleAnswer' là đáp án mẫu lý tưởng nhất.

        CẤU TRÚC JSON YÊU CẦU:
        {
          "title": "Tên đề thi",
          "questions": [
            {
              "type": "mcq",
              "prompt": "Nội dung câu hỏi",
              "options": ["A...", "B...", "C...", "D..."],
              "correctAnswerIndex": 0-3
            },
            {
              "type": "essay",
              "prompt": "Nội dung câu hỏi",
              "sampleAnswer": "Đáp án mẫu"
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
        id: `q-${idx}-${Date.now()}`
      }))
    };
  } catch (error: any) {
    throw new Error(`AI bóc tách thất bại: ${error.message}`);
  }
};

export const gradeEssayWithAI = async (prompt: string, studentAnswer: string, sampleAnswer: string): Promise<number> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Câu hỏi: ${prompt}\nĐáp án chuẩn: ${sampleAnswer}\nBài làm của học sinh: ${studentAnswer}`,
      config: {
        systemInstruction: `Bạn là giáo viên tiếng Anh bản ngữ. Hãy chấm điểm bài làm của học sinh một cách công bằng trên thang điểm 1.0.
        - 1.0 điểm: Đúng hoàn toàn về nghĩa, ngữ pháp và chính tả.
        - 0.8 điểm: Đúng về nghĩa, nhưng có lỗi nhỏ về dấu câu hoặc viết hoa.
        - 0.5 điểm: Đúng ý chính nhưng sai ngữ pháp (chia thì, số ít/nhiều).
        - 0.2 điểm: Chỉ đúng được một vài từ khóa quan trọng.
        - 0 điểm: Sai hoàn toàn hoặc để trống.
        CHỈ TRẢ VỀ DUY NHẤT CON SỐ ĐIỂM (Ví dụ: 0.8). KHÔNG GIẢI THÍCH.`,
      }
    });
    const scoreText = response.text?.trim() || "0";
    const score = parseFloat(scoreText);
    return isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
  } catch (e) {
    return 0;
  }
};
