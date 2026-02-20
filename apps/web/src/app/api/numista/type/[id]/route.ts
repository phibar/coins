import { NextRequest, NextResponse } from "next/server";
import {
  getTypeDetail,
  getTypeIssues,
  getIssuePrices,
} from "@/lib/numista";

// Simple in-memory cache (5 min TTL)
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const typeId = parseInt(id);

  if (isNaN(typeId)) {
    return NextResponse.json({ error: "Invalid type ID" }, { status: 400 });
  }

  const cacheKey = `type:${typeId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const [detail, issues] = await Promise.all([
      getTypeDetail(typeId),
      getTypeIssues(typeId).catch(() => []),
    ]);

    // Fetch prices for the first issue (representative price)
    let prices = null;
    if (issues.length > 0) {
      prices = await getIssuePrices(typeId, issues[0].id).catch(() => null);
    }

    const result = { ...detail, issues, prices };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Numista type detail error:", error);
    return NextResponse.json(
      { error: "Numista type detail failed" },
      { status: 502 }
    );
  }
}
