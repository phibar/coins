import { NextResponse } from "next/server";
import { capturePhoto } from "@/lib/camera-client";

export async function POST() {
  try {
    const result = await capturePhoto();
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.contentType,
        "X-Filename": result.filename,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Camera service unavailable" },
      { status: 503 }
    );
  }
}
