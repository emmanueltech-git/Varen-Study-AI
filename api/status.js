module.exports = function status(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  return res.status(200).json({
    onlineAiConfigured: Boolean(process.env.AI_API_KEY),
    model: process.env.AI_MODEL || "gpt-4.1-mini",
    providerConfigured: Boolean(process.env.AI_BASE_URL || process.env.AI_API_KEY)
  });
};
