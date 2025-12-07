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
        if (err