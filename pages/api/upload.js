// pages/api/upload.js
import { IncomingForm } from "formidable";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false, // required for formidable
    sizeLimit: "10mb", // safeguard; formidable will also enforce settings below
  },
};

/**
 * Simple in-memory rate limiter (per-IP). Works as a basic protection.
 * Note: in serverless, in-memory limits reset per instance. For production
 * use a shared store (Redis, Upstash, etc).
 */
const rateMap = new Map();
const WINDOW_SECONDS = parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || "60", 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "20", 10);

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
  // keep only alphanumeric in basename to avoid path attacks
  const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9-_\.]/g, "_");
  return `${Date.now()}_${id}_${base}${ext}`;
}

const ALLOWED_MIME_PREFIXES = ["image/", "audio/", "video/"]; // restrict as needed
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file

export default async function handler(req, res) {
  try {
    // Auth: simple header-based API key
    const incomingKey = req.headers["x-api-key"] || req.headers["X-API-KEY"];
    if (!incomingKey || incomingKey !== process.env.PRIVATE_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Rate limit by IP
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: "Too many requests" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Parse multipart/form-data with formidable
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

    const fileField = data.files?.file || data.files?.upload; // accept either 'file' or 'upload'
    if (!fileField) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Formidable may give an object or an array; normalize
    const file = Array.isArray(fileField) ? fileField[0] : fileField;

    // Validate MIME type
    const mimetype = file.mimetype || file.type || "";
    if (!ALLOWED_MIME_PREFIXES.some((p) => mimetype.startsWith(p))) {
      // Clean up the uploaded temp file
      await fs.unlink(file.filepath).catch(() => {});
      return res.status(400).json({ error: "Invalid file type" });
    }

    // Validate file size (double-check)
    if (file.size > MAX_FILE_BYTES) {
      await fs.unlink(file.filepath).catch(() => {});
      return res.status(400).json({ error: "File too large" });
    }

    // Sanitize filename and move to temp with safe name (optional)
    const safeName = generateSafeName(file.originalFilename || file.newFilename || "upload");
    const dest = path.join(os.tmpdir(), safeName);
    await fs.rename(file.filepath, dest);

    // === DO YOUR PROCESSING HERE ===
    // e.g., upload dest to S3, Cloud Storage, or scan it. Do NOT return secret data.
    // Example: pretend we uploaded and generated a storage key:
    const fakeStorageKey = `uploads/${safeName}`;

    // After upload/processing, remove the temp file
    await fs.unlink(dest).catch(() => {});

    return res.status(200).json({
      status: "success",
      message: "File accepted and processed",
      file: {
        name: safeName,
        size: file.size,
        mime: mimetype,
        storageKey: fakeStorageKey, // replace with real storage URL/key after you upload
      },
    });
  } catch (err) {
    // On error, try to clean any tmp files (best-effort)
    try {
      if (err?.path) await fs.unlink(err.path).catch(() => {});
    } catch (e) {}
    console.error("upload error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}