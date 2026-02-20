import { NextResponse } from "next/server";
import { getCameraStatus } from "@/lib/camera-client";

export async function GET() {
  try {
    const status = await getCameraStatus();
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ connected: false }, { status: 503 });
  }
}
