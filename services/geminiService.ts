// services/geminiService.ts

import { Question } from "../types";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
// Nếu bạn dùng Vite, nên đặt key trong .env: VITE_GEMINI_API_KEY=your-key-here

export const extractQuestionsFromText = async (text: string): Promise<{ title: string; questions: Question[] }> => {
  if (!GEMINI_API_KEY) {
    throw new Error("Chưa cấu hình GEMINI API KEY. Vui lòng kiểm tra file .env hoặc biến môi trường.");
  }

  const prompt = `
Bạn là chuyên gia bóc tách đề thi từ file Word. Hãy đọc toàn bộ nội dung bên dưới và trả về đúng định dạng JSON sau đây.

NỘI DUNG ĐỀ THI:
${text}

YÊU CẦU:
- title: Tiêu đề đề thi (nếu không có thì đặt "Đề thi mới").
- questions: danh sách câu hỏi.

Mỗi câu hỏi có định dạng:
- type: "mcq" (trắc nghiệm) hoặc "essay" (tự luận).
- prompt: nội dung câu hỏi (không bao gồm đáp án).
- options: chỉ có với mcq, mảng 4 phần tử (A, B, C, D). Nếu ít hơn thì bổ sung phần tử rỗng.
- correctAnswerIndex: chỉ với mcq, số từ 0-3 tương ứng A-B-C-D.
  + Ưu tiên tìm dấu * trước đáp án đúng (ví dụ: *B. ABC hoặc B. ABC*).
  + Nếu có Answer Key ở cuối, dùng nó.
  + Nếu không có dấu hiệu, hãy tự suy luận đáp án đúng nhất.
- sampleAnswer: chỉ với essay, đáp án mẫu ngắn gọn (nếu có trong đề thì lấy, không thì để trống).

TRẢ VỀ CHỈ MỘT JSON DUY NHẤT, KHÔNG CÓ GIẢI THÍCH THÊM, KHÔNG DÙNG MARKDOWN, KHÔNG ```json:
{
  "title": "string",
  "questions": [
    {
      "type": "mcq" | "essay",
      "prompt": "string",
      "options": ["string", "string", "string", "string"], // chỉ mcq
      "correctAnswerIndex": 0, // chỉ mcq, 0-3
      "sampleAnswer": "string" // chỉ essay
    }
  ]
}
`.trim();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Gemini API lỗi ${response.status}: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Làm sạch output (loại bỏ markdown nếu có)
    const jsonText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const result = JSON.parse(jsonText);

    // Validate và chuẩn hóa dữ liệu
    const questions = (result.questions || []).map((q: any, idx: number) => {
      const normalized: any = {
        id: `q-${idx}-${Date.now()}`,
        type: q.type === "essay" ? "essay" : "mcq",
        prompt: (q.prompt || "").trim(),
      };

      if (q.type === "mcq" || normalized.type === "mcq") {
        normalized.options = Array.isArray(q.options)
          ? q.options.slice(0, 4).map((o: string) => o.trim())
          : [];
        // Đảm bảo luôn có 4 options
        while (normalized.options.length < 4) normalized.options.push("");

        normalized.correctAnswerIndex = Number(q.correctAnswerIndex);
        if (isNaN(normalized.correctAnswerIndex) || normalized.correctAnswerIndex < 0 || normalized.correctAnswerIndex > 3) {
          normalized.correctAnswerIndex = 0; // fallback
        }
      } else {
        normalized.sampleAnswer = (q.sampleAnswer || "").trim();
      }

      return normalized as Question;
    });

    return {
      title: (result.title || "Đề thi mới").trim(),
      questions,
    };
  } catch (error: any) {
    console.error("Lỗi bóc tách đề:", error);
    throw new Error(`AI không thể bóc tách đề: ${error.message}`);
  }
};

export const gradeEssayWithAI = async (prompt: string, studentAnswer: string, sampleAnswer: string): Promise<number> => {
  if (!GEMINI_API_KEY) return 0;

  const gradePrompt = `
Câu hỏi: ${prompt}
Đáp án mẫu: ${sampleAnswer || "Không có"}
Bài làm học sinh: ${studentAnswer || "Để trống"}

Bạn là giáo viên tiếng Anh nghiêm túc nhưng công bằng.
Chấm điểm theo thang 0.0 đến 1.0 (có thể dùng 0.1, 0.2, ..., 0.9).
- Đúng hoàn toàn: 1.0
- Đúng hầu hết ý chính: 0.7–0.9
- Đúng một phần ý quan trọng: 0.4–0.6
- Sai hoặc để trống: 0.0

CHỈ TRẢ VỀ MỘT SỐ DUY NHẤT, KHÔNG GIẢI THÍCH.
`.trim();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: gradePrompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 10 },
        }),
      }
    );

    if (!response.ok) return 0;

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "0";
    const score = parseFloat(text);
    return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
  } catch (e) {
    return 0;
  }
};
