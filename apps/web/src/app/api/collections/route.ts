import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const collections = await prisma.collection.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { coins: true } },
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, thumbnailUrl: true, url: true } },
    },
  });

  return NextResponse.json(collections);
}

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name ist erforderlich" },
        { status: 400 }
      );
    }

    const collection = await prisma.collection.create({
      data: { name: name.trim(), description: description?.trim() || null },
    });

    return NextResponse.json(collection, { status: 201 });
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
    console.error("Failed to create collection:", error);
    return NextResponse.json(
      { error: "Failed to create collection" },
      { status: 500 }
    );
  }
}
