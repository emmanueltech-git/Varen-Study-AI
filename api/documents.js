const path = require("path");
const zlib = require("zlib");

function decodePdfText(buffer) {
  const source = buffer.toString("latin1");
  let text = "";
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamPattern.exec(source))) {
    let bytes = Buffer.from(match[1], "latin1");
    try { bytes = zlib.inflateSync(bytes); } catch (_) {}
    const stream = bytes.toString("latin1");

    const textPattern = /\((?:\\.|[^\\)])*\)\s*Tj/g;
    let textMatch;
    while ((textMatch = textPattern.exec(stream))) {
      text += textMatch[0]
        .replace(/^\(/, "")
        .replace(/\)\s*Tj$/, "")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\n")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")") + "\n";
    }

    const arrayPattern = /\[(.*?)\]\s*TJ/g;
    let arrayMatch;
    while ((arrayMatch = arrayPattern.exec(stream))) {
      text += arrayMatch[1].replace(/\((?:\\.|[^\\)])*\)/g, item => item.slice(1, -1)) + "\n";
    }
  }

  if (!text.trim()) {
    text = source
      .replace(/[^ -~\r\n\t]/g, " ")
      .replace(/(?:stream|endstream|xref|obj|endobj)/gi, " ");
  }

  return text
    .replace(/\0/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 500000);
}

module.exports = function documents(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const body = req.body || {};
  if (!body.name || typeof body.base64 !== "string") {
    return res.status(400).json({ error: "A file name and file data are required." });
  }

  const extension = path.extname(body.name).toLowerCase();
  if (![".pdf", ".txt", ".md", ".csv"].includes(extension)) {
    return res.status(415).json({ error: "Unsupported file type. Use PDF, TXT, MD or CSV." });
  }

  let buffer;
  try { buffer = Buffer.from(body.base64, "base64"); }
  catch (_) { return res.status(400).json({ error: "Invalid file data." }); }

  if (buffer.length > 12 * 1024 * 1024) {
    return res.status(413).json({ error: "File exceeds the 12 MB limit." });
  }

  const text = extension === ".pdf"
    ? decodePdfText(buffer)
    : buffer.toString("utf8").replace(/\0/g, "").slice(0, 500000);

  if (!text.trim()) {
    return res.status(422).json({ error: "No readable text was found in this file." });
  }

  return res.status(200).json({
    name: body.name,
    text,
    extraction: extension === ".pdf" ? "best-effort-text" : "text"
  });
};
