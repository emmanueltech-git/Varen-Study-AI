const { GoogleGenAI } = require("@google/genai");

const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.1-flash-lite";
let client;
let clientKey;

class GeminiTutorError extends Error {
  constructor(message, status, retryAfter, diagnostic) {
    super(message);
    this.name = "GeminiTutorError";
    this.status = status;
    this.retryAfter = retryAfter;
    this.diagnostic = diagnostic || createDiagnostic(
      "application_error",
      status,
      null,
      message
    );
  }
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiTutorError(
      "Online AI is not configured. Offline study tools still work.",
      503,
      undefined,
      createDiagnostic("configuration", 503, null, "GEMINI_API_KEY is not configured.")
    );
  }
  if (!client || clientKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

function getConfiguredModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

function responseStatus(error) {
  const status = Number(error?.status || error?.statusCode || error?.code);
  return Number.isInteger(status) ? status : 0;
}

function safeErrorMessage(error) {
  let message = error?.error?.message || error?.message || "Unknown Gemini error.";
  if (typeof message !== "string") message = String(message);

  try {
    const parsed = JSON.parse(message);
    message = parsed?.error?.message || parsed?.message || message;
  } catch (_) {}

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (apiKey) message = message.split(apiKey).join("[redacted]");
  return message
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[redacted]")
    .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 1000);
}

function createDiagnostic(category, httpStatus, geminiHttpStatus, errorMessage, flags = {}) {
  return {
    httpStatus,
    geminiHttpStatus,
    category,
    errorMessage,
    modelRejected: Boolean(flags.modelRejected),
    authenticationFailed: Boolean(flags.authenticationFailed),
    quotaExceeded: Boolean(flags.quotaExceeded)
  };
}

function diagnoseGeminiError(error, httpStatus) {
  const geminiHttpStatus = responseStatus(error) || null;
  const errorMessage = safeErrorMessage(error);
  const normalizedMessage = errorMessage.toLowerCase();
  const quotaExceeded = geminiHttpStatus === 429
    || /quota|resource_exhausted|rate.?limit/.test(normalizedMessage);
  const authenticationFailed = geminiHttpStatus === 401
    || /invalid api key|authentication failed|invalid credentials|unauthenticated/.test(normalizedMessage);
  const modelRejected = geminiHttpStatus === 404
    || (geminiHttpStatus === 400 && /\bmodel\b|not found|not supported/.test(normalizedMessage));
  let category = "upstream_error";

  if (quotaExceeded) category = "quota_exceeded";
  else if (authenticationFailed) category = "authentication";
  else if (modelRejected) category = "model_rejected";
  else if (geminiHttpStatus === 400) category = "invalid_request";
  else if (geminiHttpStatus === 403) category = "permission_denied";
  else if (error?.name === "TimeoutError" || error?.name === "AbortError") category = "timeout";
  else if (!geminiHttpStatus) category = "connection";

  return createDiagnostic(
    category,
    httpStatus || geminiHttpStatus || 502,
    geminiHttpStatus,
    errorMessage,
    { modelRejected, authenticationFailed, quotaExceeded }
  );
}

function publicDiagnostic(error, httpStatus) {
  if (error?.diagnostic) {
    return { ...error.diagnostic, httpStatus: httpStatus || error.diagnostic.httpStatus };
  }
  return diagnoseGeminiError(error, httpStatus);
}

function retryAfterSeconds(error) {
  const raw = error?.headers?.get?.("retry-after")
    || error?.response?.headers?.get?.("retry-after")
    || error?.retryAfter;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : undefined;
}

function normalizeHistory(messages) {
  const selected = messages.slice(-12).filter(message =>
    message && typeof message.content === "string" &&
    (message.role === "user" || message.role === "assistant")
  );
  const history = [];
  let totalCharacters = 0;

  for (const message of selected) {
    const role = message.role === "assistant" ? "model" : "user";
    const remaining = 48000 - totalCharacters;
    if (remaining <= 0) break;
    const text = message.content.slice(0, Math.min(12000, remaining));
    totalCharacters += text.length;
    const previous = history[history.length - 1];
    if (previous?.role === role) previous.parts[0].text += `\n${text}`;
    else history.push({ role, parts: [{ text }] });
  }

  while (history.length && history[0].role !== "user") history.shift();
  return history;
}

function isRetryable(error) {
  const status = responseStatus(error);
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
    || (status === 403 && diagnoseGeminiError(error).quotaExceeded);
}

function friendlyFailure(error) {
  const status = responseStatus(error);
  const retryAfter = retryAfterSeconds(error) || (status === 429 ? 30 : undefined);
  const outputStatus = status >= 400 && status <= 599
    ? status
    : (error?.name === "TimeoutError" || error?.name === "AbortError" ? 504 : 502);
  const diagnostic = diagnoseGeminiError(error, outputStatus);
  const message = diagnostic.category === "quota_exceeded"
    ? "Gemini is rate-limiting requests or quota has been exceeded. Please wait and try again."
    : diagnostic.errorMessage;
  return new GeminiTutorError(message, outputStatus, retryAfter, diagnostic);
}

async function generateWithModel(ai, model, history, systemInstruction, maxOutputTokens = 1200) {
  const response = await ai.models.generateContent({
    model,
    contents: history,
    config: {
      systemInstruction,
      maxOutputTokens
    }
  });
  const reply = response.text?.trim();
  if (!reply) {
    const diagnostic = createDiagnostic("empty_response", 502, 200, "Gemini returned an empty response.");
    throw new GeminiTutorError(diagnostic.errorMessage, 502, undefined, diagnostic);
  }
  return reply;
}

async function generateTutorReply({ messages, department, subject }) {
  if (!Array.isArray(messages)) {
    const diagnostic = createDiagnostic("invalid_request", 400, null, "Conversation history must be an array.");
    throw new GeminiTutorError(diagnostic.errorMessage, 400, undefined, diagnostic);
  }
  const history = normalizeHistory(messages);
  if (!history.length || !history.some(message => message.role === "user")) {
    const diagnostic = createDiagnostic("invalid_request", 400, null, "Add a question first.");
    throw new GeminiTutorError(diagnostic.errorMessage, 400, undefined, diagnostic);
  }

  const safeDepartment = ["Community Health", "Coding and Technology", "General Studies"].includes(department)
    ? department
    : "General Studies";
  const safeSubject = typeof subject === "string" ? subject.slice(0, 100) : "General";
  const systemInstruction = `You are Varen Study AI, a supportive study tutor for ${safeDepartment}, subject: ${safeSubject}. Explain concepts clearly and step by step using age-appropriate language. Maintain context from the conversation. Never claim to provide official examination questions or standards. For Community Health, provide educational information only, never diagnose or prescribe, and advise learners to consult qualified instructors and approved guidance for care decisions. For coding, explain safe examples without running user code.`;

  const ai = getClient();
  const primaryModel = getConfiguredModel();
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || "";

  try {
    return {
      reply: await generateWithModel(ai, primaryModel, history, systemInstruction),
      model: primaryModel,
      fallbackUsed: false
    };
  } catch (primaryError) {
    if (!fallbackModel || fallbackModel === primaryModel || !isRetryable(primaryError)) {
      if (primaryError instanceof GeminiTutorError) throw primaryError;
      throw friendlyFailure(primaryError);
    }

    try {
      return {
        reply: await generateWithModel(ai, fallbackModel, history, systemInstruction),
        model: fallbackModel,
        fallbackUsed: true
      };
    } catch (fallbackError) {
      if (fallbackError instanceof GeminiTutorError) throw fallbackError;
      throw friendlyFailure(fallbackError);
    }
  }
}

async function checkGemini() {
  const model = getConfiguredModel();
  const ai = getClient();
  try {
    await generateWithModel(
      ai,
      model,
      [{ role: "user", parts: [{ text: "Reply with OK." }] }],
      "This is a connectivity check. Reply only with OK.",
      16
    );
    return { model };
  } catch (error) {
    if (error instanceof GeminiTutorError) throw error;
    throw friendlyFailure(error);
  }
}

module.exports = {
  DEFAULT_MODEL,
  DEFAULT_FALLBACK_MODEL,
  GeminiTutorError,
  getConfiguredModel,
  checkGemini,
  publicDiagnostic,
  generateTutorReply
};
