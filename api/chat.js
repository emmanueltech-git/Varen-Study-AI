const { GeminiTutorError, generateTutorReply, publicDiagnostic } = require("../lib/gemini");

module.exports = async function chat(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
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
    const diagnostic = publicDiagnostic(error, status);
    if (error instanceof GeminiTutorError && error.retryAfter) {
      res.setHeader("Retry-After", String(error.retryAfter));
    }
    return res.status(status).json({
      error: error instanceof GeminiTutorError ? error.message : diagnostic.errorMessage,
      diagnostic
    });
  }
};
