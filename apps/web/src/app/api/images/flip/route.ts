import { NextRequest, NextResponse } from "next/server";
import { flipHorizontal } from "@/lib/image-processing";

export async function POST(request: NextRequest) {
  try {
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const flipped = await flipHorizontal(buffer);

    return new NextResponse(new Uint8Array(flipped), {
      headers: {
        "Content-Type": "image/jpeg",
      },
    });
  } catch (error) {
    console.error("Failed to flip image:", error);
    return NextResponse.json(
      { error: "Failed to flip image" },
      { status: 500 }
    );
  }
}
