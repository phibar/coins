import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { generateThumbnail } from "@/lib/image-processing";
import { uploadToS3 } from "@/lib/s3";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const collection = await prisma.collection.findUnique({
      where: { id },
      select: { id: true, _count: { select: { images: true } } },
    });

    if (!collection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { imagesBase64 } = await request.json();

    if (!imagesBase64?.length) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    const startIndex = collection._count.images;
    const created = [];

    for (let i = 0; i < imagesBase64.length; i++) {
      const buffer = Buffer.from(imagesBase64[i], "base64");
      const processed = await sharp(buffer)
        .rotate()
        .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      const thumbnail = await generateThumbnail(processed);

      const idx = startIndex + i;
      const s3Key = `collections/${id}/image_${idx}.jpg`;
      const s3KeyThumb = `collections/${id}/image_${idx}_thumb.jpg`;

      const url = await uploadToS3(s3Key, processed, "image/jpeg");
      const thumbnailUrl = await uploadToS3(s3KeyThumb, thumbnail, "image/jpeg");

      const image = await prisma.collectionImage.create({
        data: {
          collectionId: id,
          url,
          thumbnailUrl,
          s3Key,
          s3KeyThumb,
          sortOrder: idx,
        },
      });

      created.push(image);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to upload collection images:", error);
    return NextResponse.json(
      { error: "Failed to upload images" },
      { status: 500 }
    );
  }
}
