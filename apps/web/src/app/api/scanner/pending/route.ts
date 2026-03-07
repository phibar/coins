import { NextResponse } from "next/server";
import { getPendingScans } from "@/lib/scanner-client";

export async function GET() {
  try {
    const result = await getPendingScans();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ files: [], count: 0 });
  }
}
