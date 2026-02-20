const CAMERA_SERVICE_URL =
  process.env.CAMERA_SERVICE_URL || "http://localhost:3001";

export interface CameraStatus {
  connected: boolean;
  model?: string;
  port?: string;
}

export async function getCameraStatus(): Promise<CameraStatus> {
  const response = await fetch(`${CAMERA_SERVICE_URL}/status`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    return { connected: false };
  }
  return response.json();
}

export async function capturePhoto(): Promise<{
  buffer: Buffer;
  filename: string;
  contentType: string;
}> {
  const response = await fetch(`${CAMERA_SERVICE_URL}/capture`, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Camera capture failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = response.headers.get("X-Filename") || "capture.jpg";
  const contentType = response.headers.get("Content-Type") || "image/jpeg";

  return { buffer, filename, contentType };
}
