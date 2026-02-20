import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromS3 } from "@/lib/s3";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const coin = await prisma.coin.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!coin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete images from S3
    for (const image of coin.images) {
      if (image.s3Key) await deleteFromS3(image.s3Key).catch(() => {});
      if (image.s3KeyThumb) await deleteFromS3(image.s3KeyThumb).catch(() => {});
    }

    // Delete coin (cascades to images via Prisma)
    await prisma.coin.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Failed to delete coin:", error);
    return NextResponse.json(
      { error: "Failed to delete coin" },
      { status: 500 }
    );
  }
}
