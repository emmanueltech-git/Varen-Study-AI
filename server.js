// Optional online AI proxy. Keep your API key on the server; never put it in public/app.js.
const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { GeminiTutorError, generateTutorReply, DEFAULT_MODEL } = require("./lib/gemini");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const MIME = {
  ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml"
};

function send(res, status, body, type="application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type":type,
    "X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"no-referrer",
    "Cache-Control": type.includes("text/html") ? "no-cache" : "public, max-age=300"
  });
  res.end(body);
}

function readJson(req, limit, callback) {
  let raw = "";
  req.on("data", chunk => {
    raw += chunk;
    if (raw.length > limit) req.destroy();
  });
  req.on("end", () => {
    try { callback(null, JSON.parse(raw || "{}")); }
    catch (_) { callback(new Error("Invalid JSON")); }
  });
}

function decodePdfText(buffer) {
  const source = buffer.toString("latin1");
  let text = "";
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamPattern.exec(source))) {
    let bytes = Buffer.from(match[1], "latin1");
    try { bytes = zlib.inflateSync(bytes); } catch (_) {}
    const stream = bytes.toString("latin1");
    const literalPattern = /\((?:\\.|[^\\)])*\)\s*Tj/g;
    let literal;
    while ((literal = literalPattern.exec(stream))) {
        const value = literal[0].replace(/^\(/, "").replace(/\)\s*Tj$/, "").replace(/\\\(([()])/g, "$1");
        text += value.replace(/\\n/g, "\n").replace(/\\r/g, "\n").replace(/\\\(/g, "(").replace(/\\\)/g, ")") + "\n";
    }
    const tjPattern = /\[(.*?)\]\s*TJ/g;
    let tj;
    while ((tj = tjPattern.exec(stream))) {
        text += tj[1].replace(/\((?:\\.|[^\\)])*\)/g, m => m.slice(1,-1)) + "\n";
    }
  }
  if (!text.trim()) {
    text = source.replace(/[^ -~\r\n\t]/g, " ").replace(/(?:stream|endstream|xref|obj|endobj)/gi, " ");
  }
  return text.replace(/\0/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 500000);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/status") {
    return send(res, 200, JSON.stringify({
        onlineAiConfigured: Boolean(process.env.GEMINI_API_KEY),
        provider: "Google Gemini",
        model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
        fallbackConfigured: Boolean(process.env.GEMINI_FALLBACK_MODEL?.trim()),
        fallbackModel: process.env.GEMINI_FALLBACK_MODEL?.trim() || null
    }));
  }

  if (req.method === "POST" && req.url === "/api/documents") {
    return readJson(req, 15 * 1024 * 1024, (error, body) => {
        if (error) return send(res, 400, JSON.stringify({error:error.message}));
        if (!body.name || typeof body.base64 !== "string") return send(res, 400, JSON.stringify({error:"A file name and file data are required."}));
        const extension = path.extname(body.name).toLowerCase();
        if (![".pdf",".txt",".md",".csv"].includes(extension)) return send(res, 415, JSON.stringify({error:"Unsupported file type. Use PDF, TXT, MD or CSV."}));
        let buffer;
        try { buffer = Buffer.from(body.base64, "base64"); } catch (_) { return send(res, 400, JSON.stringify({error:"Invalid file data."})); }
        if (buffer.length > 12 * 1024 * 1024) return send(res, 413, JSON.stringify({error:"File exceeds the 12 MB limit."}));
        let text;
        if (extension === ".pdf") text = decodePdfText(buffer);
        else text = buffer.toString("utf8").replace(/\0/g,"").slice(0,500000);
        if (!text.trim()) return send(res, 422, JSON.stringify({error:"No readable text was found in this file."}));
        send(res, 200, JSON.stringify({name:body.name, text, extraction:extension === ".pdf" ? "best-effort-text" : "text"}));
    });
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    if (!process.env.GEMINI_API_KEY) return send(res, 503, JSON.stringify({error:"Online AI is not configured. Offline study tools still work."}));
    readJson(req, 100000, async (error, body) => {
        if (error) return send(res, 400, JSON.stringify({error:error.message}));
      try {
        const result = await generateTutorReply({
          messages: body.messages,
          department: body.department,
          subject: body.subject
        });
        send(res, 200, JSON.stringify(result));
      } catch (error) {
        const status = error instanceof GeminiTutorError ? error.status : 502;
        if (error instanceof GeminiTutorError && error.retryAfter) res.setHeader("Retry-After", String(error.retryAfter));
        send(res, status, JSON.stringify({
          error: error instanceof GeminiTutorError ? error.message : "Could not contact the Gemini service. Please try again later."
        }));
      }
    });
    return;
  }
  const clean = decodeURIComponent((req.url || "/").split("?")[0]);
  const requested = clean === "/" ? "index.html" : clean.replace(/^\/+/, "");
  const full = path.normalize(path.join(PUBLIC, requested));
  const relative = path.relative(PUBLIC, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain");
    send(res, 200, data, MIME[path.extname(full)] || "application/octet-stream");
  });
});
server.listen(PORT, () => console.log(`Varen Study AI running at http://localhost:${PORT}`));