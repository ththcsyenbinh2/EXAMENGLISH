import { GoogleGenerativeAI } from "@google/generative-ai";
import { Question } from "../types";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

/**
 * Bóc tách đề thi từ văn bản thuần (text) đã extract bằng mammoth
 * Cải tiến: Không mặc định chọn A, ưu tiên phát hiện dấu hiệu đáp án đúng (*, **, in đậm qua từ khóa)
 */
export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const prompt = `Nội dung đề thi (văn bản thuần, có thể có dấu * hoặc ** trước đáp án đúng):\n\n${text}

Bạn là chuyên gia bóc tách đề thi tiếng Việt hoặc tiếng Anh.
Nhiệm vụ: Phân tích và trả về JSON đúng cấu trúc dưới đây.

QUY TẮC XÁC ĐỊNH ĐÁP ÁN ĐÚNG TRẮC NGHIỆM (MCQ):
- Ưu tiên lựa chọn có dấu * hoặc ** ở đầu (ví dụ: "*A. ..." hoặc "**B. ...").
- Nếu không có *, tìm từ khóa gợi ý đáp án đúng như "đáp án", "correct", "key", "Answer:" ở cuối đề.
- Nếu vẫn không thấy dấu hiệu rõ ràng, hãy suy luận logic để chọn đáp án đúng nhất (KHÔNG mặc định chọn A).
- Nếu thực sự không xác định được, để "correctAnswerIndex": null.

QUY TẮC TỰ LUẬN (ESSAY):
- Nhận diện câu yêu cầu viết đoạn, trả lời mở, viết lại câu...
- Cung cấp sampleAnswer ngắn gọn, đúng trọng tâm để làm chuẩn chấm.

CẤU TRÚC JSON BẮT BUỘC:
{
  "title": "string (tiêu đề đề thi hoặc tên file nếu không có)",
  "questions": [
    {
      "type": "mcq" | "essay",
      "prompt": "nội dung câu hỏi",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."] (chỉ cho mcq),
      "correctAnswerIndex": number (0=A, 1=B, ...) hoặc null nếu không xác định,
      "sampleAnswer": "string" (chỉ cho essay, có thể để rỗng nếu không có gợi ý)
    }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Làm sạch JSON từ output của Gemini (thường bọc trong ```json)
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      throw new Error("Không thể parse JSON từ phản hồi của AI");
    }

    const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    // Xử lý thêm: tự động phát hiện * hoặc ** ở đầu option
    const processedQuestions = (data.questions || []).map((q: any, idx: number) => {
      if (q.type === "mcq" && q.options && (q.correctAnswerIndex === null || q.correctAnswerIndex === undefined)) {
        for (let i = 0; i < q.options.length; i++) {
          const opt = q.options[i].trim();
          if (opt.startsWith("*") || opt.startsWith("**")) {
            q.options[i] = opt.replace(/^\*+\s*/, "").trim(); // Xóa dấu *
            q.correctAnswerIndex = i;
            break;
          }
        }
      }

      return {
        id: `q-${idx}-${Date.now()}`,
        type: q.type,
        prompt: q.prompt || "",
        options: q.options || undefined,
        correctAnswerIndex: q.correctAnswerIndex ?? null,
        sampleAnswer: q.sampleAnswer || "",
      };
    });

    return {
      title: data.title || "Đề thi mới",
      questions: processedQuestions,
    };
  } catch (error: any) {
    console.error("Lỗi extractQuestionsFromText:", error);
    throw new Error(`AI không thể bóc tách đề: ${error.message}`);
  }
};

/**
 * Chấm điểm tự luận chính xác và ổn định hơn
 * Thang điểm: 0.0 → 1.0, bước 0.1
 */
export const gradeEssayWithAI = async (
  prompt: string,
  studentAnswer: string,
  sampleAnswer: string
): Promise<number> => {
  if (!studentAnswer.trim()) return 0;

  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: {
      temperature: 0.1,
    },
  });

  const instruction = `Bạn là giáo viên chấm thi nghiêm ngặt và công bằng.

Câu hỏi: ${prompt}
Đáp án mẫu / hướng dẫn chấm: ${sampleAnswer || "Không có đáp án mẫu"}
Bài làm học sinh: ${studentAnswer}

Hãy chấm điểm từ 0.0 đến 1.0 (bước 0.1) dựa trên:
- 1.0: Đúng hoàn toàn ý chính, ngữ pháp tốt, đủ ý.
- 0.8–0.9: Đúng ý chính, có thiếu sót nhỏ hoặc lỗi ngữ pháp nhẹ.
- 0.6–0.7: Đúng một phần ý chính, còn thiếu hoặc sai nhẹ.
- 0.4–0.5: Có nỗ lực nhưng sai nhiều hoặc thiếu ý quan trọng.
- 0.0–0.3: Sai hoàn toàn, lạc đề hoặc quá ngắn.
- 0.0: Để trống hoặc không liên quan.

CHỈ TRẢ VỀ MỘT CON SỐ DUY NHẤT (ví dụ: 0.8), KHÔNG GIẢI THÍCH, KHÔNG THÊM CHỮ.`;

  try {
    const result = await model.generateContent(instruction);
    const text = result.response.text().trim();

    const score = parseFloat(text);
    if (isNaN(score) || score < 0 || score > 1) {
      return 0;
    }
    // Làm tròn đến 0.1
    return Math.round(score * 10) / 10;
  } catch (error) {
    console.error("Lỗi chấm tự luận:", error);
    return 0;
  }
};
