// pages/api/transcribe.js
import { IncomingForm } from "formidable";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import FormData from "form-data";

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "20mb", // extra safety
  },
};

const rateMap = new Map();
const WINDOW_SECONDS = parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || "60", 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "10", 10);

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const windowStart = now - WINDOW_SECONDS * 1000;
  const entry = rateMap.get(ip) || [];
  const filtered = entry.filter((ts) => ts > windowStart);
  filtered.push(now);
  rateMap.set(ip, filtered);
  return filtered.length > MAX_REQUESTS;
}

function generateSafeName(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const id = crypto.randomBytes(10).toString("hex");
  const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9-_\.]/g, "_");
  return `${Date.now()}_${id}_${base}${ext}`;
}

const ALLOWED_MIME_PREFIXES = ["audio/", "video/"]; // allow audio and short video clips
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export default async function handler(req, res) {
  try {
    // Auth
    const incomingKey = req.headers["x-api-key"] || req.headers["X-API-KEY"];
    if (!incomingKey || incomingKey !== process.env.PRIVATE_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Rate limit
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: "Too many requests" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Parse incoming multipart/form-data with formidable
    const form = new IncomingForm({
      multiples: false,
      maxFileSize: MAX_FILE_BYTES,
      keepExtensions: true,
      uploadDir: os.tmpdir(),
    });

    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const fileField = data.files?.file || data.files?.audio || data.files?.upload;
    if (!fileField) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }
    const file = Array.isArray(fileField) ? fileField[0] : fileField;

    // Validate mime
    const mimetype = file.mimetype || file.type || "";
    if (!ALLOWED_MIME_PREFIXES.some((p) => mimetype.startsWith(p))) {
      await fs.unlink(file.filepath).catch(() => {});
      return res.status(400).json({ error: "Invalid file type; audio required" });
    }

    if (file.size > MAX_FILE_BYTES) {
      await fs.unlink(file.filepath).catch(() => {});
      return res.status(400).json({ error: "File too large" });
    }

    // Move to safe name (optional)
    const safeName = generateSafeName(file.originalFilename || file.newFilename || "audio");
    const dest = path.join(os.tmpdir(), safeName);
    await fs.rename(file.filepath, dest);

    // === Send to OpenAI transcription endpoint ===
    // NOTE: OpenAI API key must be set in process.env.OPENAI_API_KEY
    if (!process.env.OPENAI_API_KEY) {
      await fs.unlink(dest).catch(() => {});
      return res.status(500).json({ error: "Server misconfigured: missing OPENAI_API_KEY" });
    }

    // Create multipart/form-data
    const formData = new FormData();
    const fileStream = await fs.readFile(dest);
    formData.append("file", fileStream, { filename: safeName });
    // model may differ depending on OpenAI API version; "whisper-1" was common; adjust if needed
    formData.append("model", "whisper-1");

    // optional: language or prompt can be passed via fields
    // const { language } = data.fields || {};
    // if (language) formData.append("language", language);

    // Use fetch to OpenAI
    const openaiResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        // Do not set content-type; let formData set the multipart boundary
      },
      body: formData,
    });

    if (!openaiResp.ok) {
      const text = await openaiResp.text();
      // clean up
      await fs.unlink(dest).catch(() => {});
      console.error("OpenAI error:", openaiResp.status, text);
      return res.status(502).json({ error: "Transcription service error" });
    }

    const transcription = await openaiResp.json();

    // cleanup
    await fs.unlink(dest).catch(() => {});

    // Return only transcription text and minimal metadata
    return res.status(200).json({
      status: "success",
      text: transcription.text ?? transcription?.result ?? "",
    });
  } catch (err) {
    try {
      if (err?.path) await fs.unlink(err.path).catch(() => {});
    } catch (e) {}
    console.error("transcribe error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}