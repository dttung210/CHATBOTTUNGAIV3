import { GoogleGenAI } from "@google/genai";

export default async function handler(_req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        stage: "environment",
        error: "Không tìm thấy GEMINI_API_KEY trên Vercel",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents:
        "Chỉ trả lời đúng câu này: Kết nối Gemini thành công.",
    });

    return res.status(200).json({
      ok: true,
      service: "Thầy Tùng AI API",
      geminiKeyConfigured: true,
      model: "gemini-2.5-flash",
      result: response.text,
      environment: process.env.VERCEL_ENV || "unknown",
    });
  } catch (error: any) {
    console.error("GEMINI_TEST_ERROR:", error);

    return res.status(500).json({
      ok: false,
      service: "Thầy Tùng AI API",
      geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      errorName: error?.name || null,
      errorMessage: error?.message || String(error),
      errorCode: error?.code || null,
      errorStatus: error?.status || null,
      environment: process.env.VERCEL_ENV || "unknown",
    });
  }
}
