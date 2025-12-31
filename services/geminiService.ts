import { GoogleGenerativeAI } from "@google/generative-ai";
import { Question } from "../types";

// Khởi tạo một lần duy nhất để tái sử dụng
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || "");

/**
 * Bóc tách đề thi từ văn bản thuần (text từ mammoth)
 * Chỉ sửa phần cần thiết để nhận diện đáp án đúng chính xác hơn:
 * - Ưu tiên phát hiện * hoặc ** trước đáp án
 * - Không mặc định chọn A
 * - Suy luận logic nếu cần
 */
export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // Giữ ổn định, chính thức và tốt hơn preview cũ
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2, // Giảm temperature để AI tập trung và ít đoán bừa
    },
  });

  const prompt = `Nội dung đề thi (có thể có dấu * hoặc ** trước đáp án đúng):\n\n${text}

Bạn là chuyên gia bóc tách đề thi cực kỳ chính xác.

QUY TẮC XÁC ĐỊNH ĐÁP ÁN ĐÚNG CHO TRẮC NGHIỆM (MCQ) - RẤT QUAN TRỌNG:
1. Ưu tiên hàng đầu: Nếu có lựa chọn bắt đầu bằng * hoặc ** (ví dụ: "*A. ..." hoặc "**B. ..."), chọn ngay đó làm đáp án đúng.
2. Nếu không có *, tìm phần Answer Key hoặc đáp án ở cuối đề.
3. Nếu vẫn không có dấu hiệu rõ ràng, hãy suy luận logic dựa trên kiến thức để chọn đáp án đúng nhất.
4. TUYỆT ĐỐI KHÔNG mặc định chọn A (index 0) nếu không có cơ sở.

QUY TẮC TỰ LUẬN:
- Cung cấp sampleAnswer ngắn gọn, đúng trọng tâm để làm chuẩn chấm.

TRẢ VỀ JSON CHÍNH XÁC THEO CẤU TRÚC SAU, KHÔNG THÊM CHỮ:
{
  "title": "string",
  "questions": [
    {
      "type": "mcq" | "essay",
      "prompt": "string",
      "options": ["A. ...", "B. ...", ...] (chỉ mcq),
      "correctAnswerIndex": number (0=A, 1=B, ...) hoặc null nếu thực sự không xác định,
      "sampleAnswer": "string" (chỉ essay)
    }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Làm sạch JSON từ output Gemini
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/{[\s\S]*}/);
    if (!jsonMatch) throw new Error("Không parse được JSON từ AI");

    const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    // Xử lý bổ sung: tự động phát hiện và xóa dấu * nếu AI bỏ sót
    const processedQuestions = (data.questions || []).map((q: any, idx: number) => {
      if (q.type === "mcq" && q.options && (q.correctAnswerIndex === null || q.correctAnswerIndex === undefined)) {
        for (let i = 0; i < q.options.length; i++) {
          const cleanOpt = q.options[i].trim();
          if (cleanOpt.startsWith("*") || cleanOpt.startsWith("**")) {
            q.options[i] = cleanOpt.replace(/^\*+\s*/, "").trim();
            q.correctAnswerIndex = i;
            break;
          }
        }
      }

      return {
        id: `q-${idx}-${Date.now()}`,
        type: q.type,
        prompt: q.prompt || "",
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex ?? null,
        sampleAnswer: q.sampleAnswer || "",
      };
    });

    return {
      title: data.title || "Đề thi mới",
      questions: processedQuestions,
    };
  } catch (error: any) {
    console.error("Lỗi bóc tách đề:", error);
    throw new Error(`AI không thể bóc tách đề: ${error.message}`);
  }
};

/**
 * Chấm tự luận chính xác và công bằng hơn
 * Thang điểm 0.0 → 1.0 với bước 0.1
 */
export const gradeEssayWithAI = async (
  prompt: string,
  studentAnswer: string,
  sampleAnswer: string
): Promise<number> => {
  if (!studentAnswer.trim()) return 0.0;

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.1,
    },
  });

  const instruction = `Bạn là giáo viên chấm thi nghiêm ngặt, công bằng.

Câu hỏi: ${prompt}
Đáp án mẫu / hướng dẫn chấm: ${sampleAnswer || "Không có đáp án mẫu"}
Bài làm học sinh: ${studentAnswer}

Chấm điểm theo thang 0.0 đến 1.0 (bước 0.1) như sau:
- 1.0: Đúng hoàn toàn ý chính và phụ, ngữ pháp tốt
- 0.8–0.9: Đúng ý chính, thiếu ý phụ nhỏ hoặc lỗi nhẹ
- 0.6–0.7: Đúng một phần ý chính
- 0.4–0.5: Có nỗ lực nhưng sai nhiều hoặc thiếu ý quan trọng
- 0.2–0.3: Rất ít đúng hoặc lạc đề nhẹ
- 0.0: Sai hoàn toàn, lạc đề hoặc để trống

CHỈ TRẢ VỀ MỘT CON SỐ DUY NHẤT (ví dụ: 0.8). KHÔNG GIẢI THÍCH, KHÔNG THÊM KÝ TỰ.`;

  try {
    const result = await model.generateContent(instruction);
    const text = result.response.text().trim();
    const score = parseFloat(text);

    if (isNaN(score) || score < 0 || score > 1) return 0.0;
    return Math.round(score * 10) / 10; // Làm tròn đến 0.1
  } catch (error) {
    console.error("Lỗi chấm tự luận:", error);
    return 0.0;
  }
};
