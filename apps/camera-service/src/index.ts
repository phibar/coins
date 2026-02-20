import express from "express";
import cors from "cors";
import { captureImage, checkCamera, ensureMaxQuality } from "./capture.js";

const app = express();
const PORT = process.env.CAMERA_PORT || 3001;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "camera-service" });
});

app.get("/status", async (_req, res) => {
  try {
    const status = await checkCamera();
    res.json(status);
  } catch (error) {
    res.status(503).json({ connected: false, error: String(error) });
  }
});

app.post("/capture", async (_req, res) => {
  try {
    const result = await captureImage();
    res.set("Content-Type", result.mimeType);
    res.set("X-Filename", result.filename);
    res.send(result.buffer);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.listen(PORT, async () => {
  console.log(`Camera service running on http://localhost:${PORT}`);
  await ensureMaxQuality();
});
