const test = require("node:test");
const assert = require("node:assert/strict");
const chat = require("../api/chat");

function responseRecorder() {
  return {
    code: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return body; }
  };
}

async function callChat(body, method = "POST") {
  const res = responseRecorder();
  await chat({ method, body }, res);
  return res;
}

test("chat route reports missing server key without breaking offline use", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const result = await callChat({ messages: [{ role: "user", content: "Hello" }] });
    assert.equal(result.code, 503);
    assert.match(result.body.error, /offline study tools still work/i);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("official GenAI SDK receives context and conversation history", async () => {
  const originalFetch = global.fetch;
  const previous = {
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    fallback: process.env.GEMINI_FALLBACK_MODEL
  };
  let requestUrl;
  let requestBody;
  process.env.GEMINI_API_KEY = "test-key-not-a-credential";
  process.env.GEMINI_MODEL = "gemini-3.8-flash";
  delete process.env.GEMINI_FALLBACK_MODEL;
  global.fetch = async (url, init) => {
    requestUrl = String(url);
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      candidates: [{
        content: { role: "model", parts: [{ text: "A contextual Gemini answer." }] },
        finishReason: "STOP"
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await callChat({
      department: "Community Health",
      subject: "Primary Health Care",
      messages: [
        { role: "user", content: "What is PHC?" },
        { role: "assistant", content: "It is essential first-contact care." },
        { role: "user", content: "How is community participation involved?" }
      ]
    });

    assert.equal(result.code, 200);
    assert.equal(result.body.reply, "A contextual Gemini answer.");
    assert.equal(result.body.model, "gemini-3.8-flash");
    assert.match(requestUrl, /models\/gemini-3\.8-flash:generateContent/);
    assert.deepEqual(requestBody.contents.map(content => content.role), ["user", "model", "user"]);
    assert.match(requestBody.systemInstruction.parts[0].text, /Community Health/);
    assert.match(requestBody.systemInstruction.parts[0].text, /Primary Health Care/);
  } finally {
    global.fetch = originalFetch;
    if (previous.key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous.key;
    if (previous.model === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previous.model;
    if (previous.fallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = previous.fallback;
  }
});

test("rate limits fall back to Flash-Lite when configured", async () => {
  const originalFetch = global.fetch;
  const previous = {
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    fallback: process.env.GEMINI_FALLBACK_MODEL
  };
  const requestedModels = [];
  process.env.GEMINI_API_KEY = "test-key-not-a-credential";
  process.env.GEMINI_MODEL = "gemini-3.8-flash";
  process.env.GEMINI_FALLBACK_MODEL = "gemini-3.1-flash-lite";
  global.fetch = async (url) => {
    const model = String(url).match(/models\/([^:]+)/)[1];
    requestedModels.push(model);
    if (model === "gemini-3.8-flash") {
      return new Response(JSON.stringify({
        error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "rate limited" }
      }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "2" } });
    }
    return new Response(JSON.stringify({
      candidates: [{
        content: { role: "model", parts: [{ text: "Fallback tutor response." }] },
        finishReason: "STOP"
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await callChat({
      department: "Coding and Technology",
      subject: "JavaScript",
      messages: [{ role: "user", content: "Explain closures." }]
    });
    assert.equal(result.code, 200);
    assert.equal(result.body.fallbackUsed, true);
    assert.equal(result.body.model, "gemini-3.1-flash-lite");
    assert.deepEqual(requestedModels, ["gemini-3.8-flash", "gemini-3.1-flash-lite"]);
  } finally {
    global.fetch = originalFetch;
    if (previous.key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous.key;
    if (previous.model === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previous.model;
    if (previous.fallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = previous.fallback;
  }
});

test("rate-limit response provides Retry-After when fallback is disabled", async () => {
  const originalFetch = global.fetch;
  const previous = {
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    fallback: process.env.GEMINI_FALLBACK_MODEL
  };
  process.env.GEMINI_API_KEY = "test-key-not-a-credential";
  process.env.GEMINI_MODEL = "gemini-3.8-flash";
  delete process.env.GEMINI_FALLBACK_MODEL;
  global.fetch = async () => new Response(JSON.stringify({
    error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "rate limited" }
  }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "3" } });

  try {
    const result = await callChat({
      messages: [{ role: "user", content: "Please explain this topic." }]
    });
    assert.equal(result.code, 429);
    assert.equal(result.headers["Retry-After"], "30");
    assert.match(result.body.error, /rate-limiting/i);
  } finally {
    global.fetch = originalFetch;
    if (previous.key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous.key;
    if (previous.model === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previous.model;
    if (previous.fallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
    else process.env.GEMINI_FALLBACK_MODEL = previous.fallback;
  }
});
