module.exports = async function chat(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.AI_API_KEY) {
    return res.status(503).json({
      error: "Online AI is not configured. Offline study tools still work."
    });
  }

  const messages = Array.isArray(req.body?.messages)
    ? req.body.messages
        .slice(-12)
        .filter(message => typeof message?.content === "string")
        .map(message => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content.slice(0, 12000)
        }))
    : [];

  if (!messages.length) {
    return res.status(400).json({ error: "Add a question first." });
  }

  const department = ["Community Health", "Coding and Technology", "General Studies"].includes(req.body.department)
    ? req.body.department
    : "General Studies";
  const subject = typeof req.body.subject === "string" ? req.body.subject.slice(0, 100) : "General";
  const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1/chat/completions";

  try {
    const upstream = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `You are Varen Study AI, a supportive tutor for ${department}, subject: ${subject}. Explain step by step with age-appropriate language. Never claim to be an official examination, clinical or accredited source. For health topics, distinguish education from professional medical advice and never diagnose or prescribe.`
          },
          ...messages
        ],
        temperature: 0.4
      }),
      signal: AbortSignal.timeout(25000)
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data.error?.message || "AI provider request failed."
      });
    }

    return res.status(200).json({
      reply: data.choices?.[0]?.message?.content || "I couldn't generate a reply."
    });
  } catch (error) {
    const timeout = error?.name === "TimeoutError";
    return res.status(timeout ? 504 : 502).json({
      error: timeout
        ? "The AI provider timed out."
        : "Could not contact the online AI service."
    });
  }
};
