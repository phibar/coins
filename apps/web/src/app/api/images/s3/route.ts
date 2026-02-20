import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET } from "@/lib/s3";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  try {
    const result = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );

    const body = await result.Body?.transformToByteArray();
    if (!body) {
      return NextResponse.json({ error: "Empty body" }, { status: 404 });
    }

    return new NextResponse(Buffer.from(body), {
      headers: {
        "Content-Type": result.ContentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("S3 proxy error:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
