const { GeminiTutorError, generateTutorReply } = require("../lib/gemini");

module.exports = async function chat(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: "Online AI is not configured. Offline study tools still work."
    });
  }

  try {
    const result = await generateTutorReply({
      messages: req.body?.messages,
      department: req.body?.department,
      subject: req.body?.subject
    });
    return res.status(200).json(result);
  } catch (error) {
    const status = error instanceof GeminiTutorError ? error.status : 502;
    if (error instanceof GeminiTutorError && error.retryAfter) {
      res.setHeader("Retry-After", String(error.retryAfter));
    }
    return res.status(status).json({
      error: error instanceof GeminiTutorError
        ? error.message
        : "Could not contact the Gemini service. Please try again later."
    });
  }
};
