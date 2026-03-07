import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { watch, type FSWatcher } from "fs";

const SCAN_FOLDER = path.join(os.homedir(), "Scans");
const PROCESSED_FOLDER = path.join(SCAN_FOLDER, "processed");

// Pending scanned files (in order of detection)
let pendingFiles: string[] = [];
let watcher: FSWatcher | null = null;

export async function startWatching(): Promise<void> {
  // Ensure folders exist
  await fs.mkdir(SCAN_FOLDER, { recursive: true });
  await fs.mkdir(PROCESSED_FOLDER, { recursive: true });

  // Pick up any existing JPEGs on startup
  await scanForExisting();

  // Watch for new files
  watcher = watch(SCAN_FOLDER, async (eventType, filename) => {
    if (!filename || !filename.match(/\.(jpg|jpeg)$/i)) return;
    const filePath = path.join(SCAN_FOLDER, filename);

    // Small delay — Epson Scan 2 may still be writing
    await new Promise((r) => setTimeout(r, 500));

    try {
      await fs.access(filePath);
      if (!pendingFiles.includes(filePath)) {
        pendingFiles.push(filePath);
        console.log(`New scan detected: ${filename}`);
      }
    } catch {
      // File disappeared
    }
  });

  console.log(`Watching for scans in ${SCAN_FOLDER}`);
}

async function scanForExisting(): Promise<void> {
  try {
    const files = await fs.readdir(SCAN_FOLDER);
    const jpegFiles = files
      .filter((f) => /\.(jpg|jpeg)$/i.test(f))
      .sort()
      .map((f) => path.join(SCAN_FOLDER, f));

    for (const filePath of jpegFiles) {
      if (!pendingFiles.includes(filePath)) {
        pendingFiles.push(filePath);
      }
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
      const filename = path.basename(filePath);
      const dest = path.join(PROCESSED_FOLDER, filename);
      await fs.rename(filePath, dest);
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
