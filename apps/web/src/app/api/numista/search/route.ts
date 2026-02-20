import { NextRequest, NextResponse } from "next/server";
import { searchTypes } from "@/lib/numista";

// Simple in-memory cache (5 min TTL)
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ count: 0, types: [] });
  }

  const cacheKey = params.toString();
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const result = await searchTypes({
      q,
      issuer: params.get("issuer") || undefined,
      year: params.get("year") ? parseInt(params.get("year")!) : undefined,
      category: params.get("category") || "coin",
      count: 20,
      lang: "de",
    });

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Numista search error:", error);
    return NextResponse.json(
      { error: "Numista search failed" },
      { status: 502 }
    );
  }
}
