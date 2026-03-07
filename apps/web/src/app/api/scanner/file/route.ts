import { NextRequest, NextResponse } from "next/server";
import { getScanFile } from "@/lib/scanner-client";

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    const buffer = await getScanFile(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "image/jpeg" },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
