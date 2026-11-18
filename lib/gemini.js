const { GoogleGenAI } = require("@google/genai");

const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.1-flash-lite";
let client;
let clientKey;

class GeminiTutorError extends Error {
  constructor(message, status, retryAfter) {
    super(message);
    this.name = "GeminiTutorError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiTutorError("Online AI is not configured. Offline study tools still work.", 503);
  }
  if (!client || clientKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

function responseStatus(error) {
  const status = Number(error?.status || error?.statusCode || error?.code);
  return Number.isInteger(status) ? status : 0;
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

function isRetryable(status) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function friendlyFailure(error) {
  const status = responseStatus(error);
  const retryAfter = retryAfterSeconds(error);
  if (status === 429) {
    return new GeminiTutorError("Gemini is rate-limiting requests. Please wait a moment and try again.", 429, retryAfter || 30);
  }
  if (status === 408 || error?.name === "TimeoutError" || error?.name === "AbortError") {
    return new GeminiTutorError("The Gemini request timed out. Please try again.", 504);
  }
  if (status === 401 || status === 403) {
    return new GeminiTutorError("Gemini rejected the server credentials. Check GEMINI_API_KEY and its API access.", 502);
  }
  if (status === 400 || status === 404) {
    return new GeminiTutorError("Gemini rejected the request or model. Check GEMINI_MODEL and the request content.", 502);
  }
  return new GeminiTutorError("Could not contact the Gemini service. Please try again later.", 502);
}

async function generateWithModel(ai, model, history, systemInstruction) {
  const response = await ai.models.generateContent({
    model,
    contents: history,
    config: {
      systemInstruction,
      maxOutputTokens: 1200
    }
  });
  const reply = response.text?.trim();
  if (!reply) throw new GeminiTutorError("Gemini returned an empty response. Please try again.", 502);
  return reply;
}

async function generateTutorReply({ messages, department, subject }) {
  const history = normalizeHistory(messages);
  if (!history.length || !history.some(message => message.role === "user")) {
    throw new GeminiTutorError("Add a question first.", 400);
  }

  const safeDepartment = ["Community Health", "Coding and Technology", "General Studies"].includes(department)
    ? department
    : "General Studies";
  const safeSubject = typeof subject === "string" ? subject.slice(0, 100) : "General";
  const systemInstruction = `You are Varen Study AI, a supportive study tutor for ${safeDepartment}, subject: ${safeSubject}. Explain concepts clearly and step by step using age-appropriate language. Maintain context from the conversation. Never claim to provide official examination questions or standards. For Community Health, provide educational information only, never diagnose or prescribe, and advise learners to consult qualified instructors and approved guidance for care decisions. For coding, explain safe examples without running user code.`;

  const ai = getClient();
  const primaryModel = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || "";

  try {
    return {
      reply: await generateWithModel(ai, primaryModel, history, systemInstruction),
      model: primaryModel,
      fallbackUsed: false
    };
  } catch (primaryError) {
    const primaryStatus = responseStatus(primaryError);
    if (!fallbackModel || fallbackModel === primaryModel || !isRetryable(primaryStatus)) {
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

module.exports = {
  DEFAULT_MODEL,
  DEFAULT_FALLBACK_MODEL,
  GeminiTutorError,
  generateTutorReply
};
