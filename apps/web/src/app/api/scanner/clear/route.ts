import { NextResponse } from "next/server";
import { clearPendingScans } from "@/lib/scanner-client";

export async function POST() {
  try {
    await clearPendingScans();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Clear failed" }, { status: 500 });
  }
}
