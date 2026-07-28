import app from "../server";

export default function handler(req: any, res: any) {
  try {
    const currentUrl = new URL(
      req.url || "/api/health",
      "http://localhost"
    );

    const target = currentUrl.searchParams.get("target");

    // Khi mở trực tiếp /api/health
    if (!target) {
      req.url = "/api/health";
      return app(req, res);
    }

    // Khi một API khác được Vercel chuyển đến health.ts
    const allowedTargets = [
      "analyze-problem",
      "generate-response",
      "explain-hint",
      "check-step",
      "generate-similar",
      "summarize-session",
      "generate-geometry-spec",
    ];

    if (!allowedTargets.includes(target)) {
      return res.status(404).json({
        ok: false,
        error: "API không tồn tại",
        target,
      });
    }

    // Chuyển lại đúng đường dẫn để Express trong server.ts xử lý
    req.url = `/api/${target}`;

    return app(req, res);
  } catch (error: any) {
    console.error("API_GATEWAY_ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Lỗi cổng API",
    });
  }
}
