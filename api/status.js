module.exports = function status(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  return res.status(200).json({
    onlineAiConfigured: Boolean(process.env.GEMINI_API_KEY),
    provider: "Google Gemini",
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
    fallbackConfigured: Boolean(process.env.GEMINI_FALLBACK_MODEL?.trim()),
    fallbackModel: process.env.GEMINI_FALLBACK_MODEL?.trim() || null
  });
};
