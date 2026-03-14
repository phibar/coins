import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { watch, type FSWatcher } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const SCAN_FOLDER = path.join(os.homedir(), "Scans");
// Pending scanned files (in order of detection)
let pendingFiles: string[] = [];
let watcher: FSWatcher | null = null;

/**
 * Convert a PDF to JPEG using macOS qlmanage, then remove the original PDF.
 * Returns the path to the converted JPEG, or null on failure.
 */
async function convertPdfToJpeg(pdfPath: string): Promise<string | null> {
  const basename = path.basename(pdfPath, path.extname(pdfPath));
  // qlmanage outputs to a directory; it creates <basename>.pdf.png
  const outDir = SCAN_FOLDER;
  try {
    await execFileAsync("qlmanage", [
      "-t",
      "-s",
      "3000",
      "-o",
      outDir,
      pdfPath,
    ]);
    // qlmanage creates <filename>.pdf.png
    const pngPath = path.join(outDir, `${basename}.pdf.png`);
    const jpegPath = path.join(outDir, `${basename}.jpg`);
    // Convert PNG to JPEG using sips (macOS built-in)
    await execFileAsync("sips", [
      "-s",
      "format",
      "jpeg",
      "-s",
      "formatOptions",
      "90",
      pngPath,
      "--out",
      jpegPath,
    ]);
    // Clean up PNG and original PDF
    await fs.unlink(pngPath).catch(() => {});
    await fs.unlink(pdfPath).catch(() => {});
    console.log(`Converted PDF to JPEG: ${basename}.jpg`);
    return jpegPath;
  } catch (err) {
    console.error(`Failed to convert PDF ${pdfPath}:`, err);
    return null;
  }
}

async function addFile(filePath: string): Promise<void> {
  if (pendingFiles.includes(filePath)) return;

  if (/\.pdf$/i.test(filePath)) {
    const jpegPath = await convertPdfToJpeg(filePath);
    if (jpegPath && !pendingFiles.includes(jpegPath)) {
      pendingFiles.push(jpegPath);
    }
  } else {
    pendingFiles.push(filePath);
  }
}

export async function startWatching(): Promise<void> {
  // Ensure folder exists
  await fs.mkdir(SCAN_FOLDER, { recursive: true });

  // Pick up any existing files on startup
  await scanForExisting();

  // Watch for new files
  watcher = watch(SCAN_FOLDER, async (eventType, filename) => {
    if (!filename || !filename.match(/\.(jpg|jpeg|pdf)$/i)) return;
    const filePath = path.join(SCAN_FOLDER, filename);

    // Small delay — scanner software may still be writing
    await new Promise((r) => setTimeout(r, 500));

    try {
      await fs.access(filePath);
      await addFile(filePath);
      console.log(`New scan detected: ${filename}`);
    } catch {
      // File disappeared
    }
  });

  console.log(`Watching for scans in ${SCAN_FOLDER}`);
}

async function scanForExisting(): Promise<void> {
  try {
    const files = await fs.readdir(SCAN_FOLDER);
    const scanFiles = files
      .filter((f) => /\.(jpg|jpeg|pdf)$/i.test(f))
      .sort()
      .map((f) => path.join(SCAN_FOLDER, f));

    for (const filePath of scanFiles) {
      await addFile(filePath);
    }

    if (pendingFiles.length > 0) {
      console.log(`Found ${pendingFiles.length} existing scan(s)`);
    }
  } catch {
    // Folder might not exist yet
  }
}

export function getPendingScans(): { files: string[]; count: number } {
  return { files: pendingFiles, count: pendingFiles.length };
}

export async function readScanFile(filePath: string): Promise<Buffer> {
  // Security: only serve files from the scan folder
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(SCAN_FOLDER)) {
    throw new Error("Access denied");
  }
  return fs.readFile(resolved);
}

export async function clearPendingScans(): Promise<void> {
  for (const filePath of pendingFiles) {
    try {
      await fs.unlink(filePath);
    } catch {
      // File may already be gone
    }
  }
  pendingFiles = [];
}

export function stopWatching(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
