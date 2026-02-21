import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromS3 } from "@/lib/s3";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;

  try {
    const image = await prisma.collectionImage.findFirst({
      where: { id: imageId, collectionId: id },
    });

    if (!image) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteFromS3(image.s3Key).catch(() => {});
    await deleteFromS3(image.s3KeyThumb).catch(() => {});

    await prisma.collectionImage.delete({ where: { id: imageId } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Failed to delete collection image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
