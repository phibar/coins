const CAMERA_SERVICE_URL =
  process.env.CAMERA_SERVICE_URL || "http://localhost:3001";

export interface PendingScans {
  files: string[];
  count: number;
}

export async function getPendingScans(): Promise<PendingScans> {
  const response = await fetch(`${CAMERA_SERVICE_URL}/scanner/pending`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    return { files: [], count: 0 };
  }
  return response.json();
}

export async function getScanFile(filePath: string): Promise<Buffer> {
  const response = await fetch(
    `${CAMERA_SERVICE_URL}/scanner/file?path=${encodeURIComponent(filePath)}`,
    { signal: AbortSignal.timeout(30000) }
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch scan file: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function clearPendingScans(): Promise<void> {
  await fetch(`${CAMERA_SERVICE_URL}/scanner/clear`, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
  });
}
