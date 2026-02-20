import { NextRequest, NextResponse } from "next/server";
import { detectCoins } from "@/lib/coin-detection";

export async function POST(request: NextRequest) {
  try {
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await detectCoins(buffer);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Coin detection failed:", error);
    return NextResponse.json(
      { error: "Detection failed" },
      { status: 500 }
    );
  }
}
