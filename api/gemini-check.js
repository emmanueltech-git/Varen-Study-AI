const {
  GeminiTutorError,
  getConfiguredModel,
  checkGemini,
  publicDiagnostic
} = require("../lib/gemini");

module.exports = async function geminiCheck(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKeyConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  try {
    const result = await checkGemini();
    return res.status(200).json({
      apiKeyConfigured,
      model: result.model,
      requestSucceeded: true
    });
  } catch (error) {
    const status = error instanceof GeminiTutorError ? error.status : 502;
    const diagnostic = publicDiagnostic(error, status);
    return res.status(status).json({
      apiKeyConfigured,
      model: getConfiguredModel(),
      requestSucceeded: false,
      error: error instanceof GeminiTutorError ? error.message : diagnostic.errorMessage,
      diagnostic
    });
  }
};
