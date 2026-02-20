import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { searchByImage } from "@/lib/numista";

const MAX_DIMENSION = 1024;

async function resizeAndBase64(buffer: Buffer): Promise<string> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  let processed = sharp(buffer).rotate();

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    processed = processed.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const jpeg = await processed.jpeg({ quality: 85 }).toBuffer();
  return jpeg.toString("base64");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const images: { image_data: string; mime_type: string }[] = [];

    for (const key of ["front", "back"]) {
      const file = formData.get(key);
      if (file && file instanceof Blob) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = await resizeAndBase64(buffer);
        images.push({ image_data: base64, mime_type: "image/jpeg" });
      }
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    console.log(
      "[search-by-image] Sending",
      images.length,
      "images, base64 lengths:",
      images.map((i) => i.image_data.length)
    );

    const result = await searchByImage(images);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Numista image search failed:", error);
    const message =
      error instanceof Error ? error.message : "Image search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
