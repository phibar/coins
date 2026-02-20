import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);

let isCapturing = false;

export async function ensureJpegMode(): Promise<void> {
  try {
    const { stdout } = await execFileAsync("gphoto2", [
      "--get-config",
      "imagequality",
    ]);
    if (!stdout.includes("Current: Fine") && !stdout.includes("Current: Standard")) {
      console.log("Setting camera to JPEG Fine mode...");
      await execFileAsync("gphoto2", ["--set-config", "imagequality=Fine"]);
      console.log("Camera set to JPEG Fine.");
    }
  } catch {
    // Camera might not be connected yet, skip
  }
}

export interface CameraStatus {
  connected: boolean;
  model?: string;
  port?: string;
}

export async function checkCamera(): Promise<CameraStatus> {
  try {
    const { stdout } = await execFileAsync("gphoto2", ["--auto-detect"], {
      timeout: 10000,
    });
    const lines = stdout.trim().split("\n");
    // First two lines are header + separator
    if (lines.length > 2) {
      const match = lines[2].match(/^(.+?)\s{2,}(.+)$/);
      return {
        connected: true,
        model: match?.[1]?.trim(),
        port: match?.[2]?.trim(),
      };
    }
    return { connected: false };
  } catch {
    return { connected: false };
  }
}

export async function captureImage(): Promise<{
  buffer: Buffer;
  filename: string;
  mimeType: string;
}> {
  if (isCapturing) {
    throw new Error("Capture already in progress");
  }

  isCapturing = true;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "muenz-capture-"));

  try {
    await execFileAsync(
      "gphoto2",
      [
        "--capture-image-and-download",
        "--filename",
        path.join(tmpDir, "capture.%C"),
        "--force-overwrite",
      ],
      { timeout: 30000 }
    );

    const files = await fs.readdir(tmpDir);

    // Prefer JPEG over RAW if both exist (RAW+JPEG mode)
    const jpegFile = files.find((f) => /\.(jpg|jpeg)$/i.test(f));
    const rawFile = files.find((f) => /\.(arw|raw|cr2|nef|tiff?)$/i.test(f));
    const imageFile = jpegFile || rawFile;

    if (!imageFile) {
      throw new Error("No image file captured");
    }

    if (!jpegFile && rawFile) {
      throw new Error(
        `Camera captured RAW format (${rawFile}). Set camera to JPEG: gphoto2 --set-config imagequality="Fine"`
      );
    }

    const filePath = path.join(tmpDir, imageFile);
    const buffer = await fs.readFile(filePath);

    return { buffer, filename: imageFile, mimeType: "image/jpeg" };
  } finally {
    isCapturing = false;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
