import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromS3 } from "@/lib/s3";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, description } = await request.json();

  try {
    const collection = await prisma.collection.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
      },
    });

    return NextResponse.json(collection);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Eine Sammlung mit diesem Namen existiert bereits" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update collection" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const images = await prisma.collectionImage.findMany({
    where: { collectionId: id },
    select: { s3Key: true, s3KeyThumb: true },
  });

  for (const img of images) {
    await deleteFromS3(img.s3Key).catch(() => {});
    await deleteFromS3(img.s3KeyThumb).catch(() => {});
  }

  await prisma.collection.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
