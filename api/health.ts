export default function handler(_req: any, res: any) {
  return res.status(200).json({
    ok: true,
    service: "Thầy Tùng AI API",
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    environment: process.env.VERCEL_ENV || "unknown",
  });
}
