import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { cropImage, generateThumbnail } from "@/lib/image-processing";
import { uploadToS3 } from "@/lib/s3";
import { addToNumistaCollection } from "@/lib/numista";
import type { CoinCondition, ItemType } from "@/generated/prisma/client";

// Map German grade names (from Numista lang=de) to CoinCondition enum values
const GRADE_TO_CONDITION: Record<string, string> = {
  Gut: "G",
  "Sehr gut": "VG",
  "Schön": "F",
  "Sehr Schön": "VF",
  "Vorzüglich": "XF",
  "Fast unzirkuliert": "AU",
  "Prägefrisch": "UNC",
};

function normalizeCondition(value: string | null | undefined): CoinCondition | null {
  if (!value) return null;
  // Already a valid enum value?
  const validValues = ["G", "VG", "F", "VF", "XF", "AU", "UNC", "PROOF"];
  if (validValues.includes(value)) return value as CoinCondition;
  // Try German name mapping
  const mapped = GRADE_TO_CONDITION[value];
  if (mapped) return mapped as CoinCondition;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      formData,
      frontImageBase64,
      backImageBase64,
      documentImagesBase64,
      frontCrop,
      backCrop,
    } = body;

    // Create coin in DB
    const coin = await prisma.coin.create({
      data: {
        itemType: (formData.itemType as ItemType) || "coin",
        country: formData.country || null,
        denomination: formData.denomination || null,
        year: formData.year || null,
        description: formData.description || null,
        count: formData.count ? parseInt(String(formData.count)) : null,
        mintMark: formData.mintMark || null,
        material: formData.material || null,
        fineness: formData.fineness ? parseFloat(formData.fineness) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        diameter: formData.diameter ? parseFloat(formData.diameter) : null,
        thickness: formData.thickness ? parseFloat(formData.thickness) : null,
        condition: normalizeCondition(formData.condition),
        isProof: formData.isProof || false,
        isFirstDay: formData.isFirstDay || false,
        hasCase: formData.hasCase || false,
        hasCertificate: formData.hasCertificate || false,
        edgeType: formData.edgeType || null,
        mintage: formData.mintage ? parseInt(formData.mintage) : null,
        storageLocation: formData.storageLocation || null,
        notes: formData.notes || null,
        tags: formData.tags || [],

        // Numista integration
        numistaTypeId: formData.numistaTypeId || null,
        numistaTitle: formData.numistaTitle || null,
        numistaUrl: formData.numistaUrl || null,
        numistaLastSync: formData.numistaTypeId ? new Date() : null,

        // Numista structured scalar fields
        shape: formData.shape || null,
        orientation: formData.orientation || null,
        technique: formData.technique || null,
        series: formData.series || null,
        commemoratedTopic: formData.commemoratedTopic || null,
        isDemonetized: formData.isDemonetized || false,
        demonetizationDate: formData.demonetizationDate || null,
        comments: formData.comments || null,

        // Estimated value
        estimatedValue: formData.estimatedValue || null,
        estimatedCurrency: formData.estimatedCurrency || "EUR",

        // Numista reference images
        numistaObverseThumbnail: formData.numistaObverseThumbnail || null,
        numistaReverseThumbnail: formData.numistaReverseThumbnail || null,

        // Numista complex Json data
        numistaObverse: formData.numistaObverse || undefined,
        numistaReverse: formData.numistaReverse || undefined,
        numistaReferences: formData.numistaReferences || undefined,
        numistaMints: formData.numistaMints || undefined,
        numistaRuler: formData.numistaRuler || undefined,
        numistaIssues: formData.numistaIssues || undefined,
        numistaPrices: formData.numistaPrices || undefined,
        numistaRelatedTypes: formData.numistaRelatedTypes || undefined,

        // Collection
        collectionId: formData.collectionId || null,
      },
    });

    // Process and upload front image
    if (frontImageBase64 && frontCrop) {
      const frontBuffer = Buffer.from(frontImageBase64, "base64");
      const cropped = await cropImage(frontBuffer, frontCrop);
      const thumbnail = await generateThumbnail(cropped);

      const s3Key = `coins/${coin.id}/obverse.jpg`;
      const s3KeyThumb = `coins/${coin.id}/obverse_thumb.jpg`;

      const url = await uploadToS3(s3Key, cropped, "image/jpeg");
      const thumbnailUrl = await uploadToS3(s3KeyThumb, thumbnail, "image/jpeg");

      await prisma.coinImage.create({
        data: {
          coinId: coin.id,
          type: "obverse",
          url,
          thumbnailUrl,
          s3Key,
          s3KeyThumb: s3KeyThumb,
        },
      });
    }

    // Process and upload back image
    if (backImageBase64 && backCrop) {
      const backBuffer = Buffer.from(backImageBase64, "base64");
      const cropped = await cropImage(backBuffer, backCrop);
      const thumbnail = await generateThumbnail(cropped);

      const s3Key = `coins/${coin.id}/reverse.jpg`;
      const s3KeyThumb = `coins/${coin.id}/reverse_thumb.jpg`;

      const url = await uploadToS3(s3Key, cropped, "image/jpeg");
      const thumbnailUrl = await uploadToS3(s3KeyThumb, thumbnail, "image/jpeg");

      await prisma.coinImage.create({
        data: {
          coinId: coin.id,
          type: "reverse",
          url,
          thumbnailUrl,
          s3Key,
          s3KeyThumb: s3KeyThumb,
        },
      });
    }

    // Process and upload document images
    if (documentImagesBase64?.length > 0) {
      for (let i = 0; i < documentImagesBase64.length; i++) {
        const docBuffer = Buffer.from(documentImagesBase64[i], "base64");
        const processed = await sharp(docBuffer)
          .rotate()
          .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();
        const thumbnail = await generateThumbnail(processed);

        const s3Key = `coins/${coin.id}/document_${i}.jpg`;
        const s3KeyThumb = `coins/${coin.id}/document_${i}_thumb.jpg`;

        const url = await uploadToS3(s3Key, processed, "image/jpeg");
        const thumbnailUrl = await uploadToS3(s3KeyThumb, thumbnail, "image/jpeg");

        await prisma.coinImage.create({
          data: {
            coinId: coin.id,
            type: "certificate",
            url,
            thumbnailUrl,
            s3Key,
            s3KeyThumb,
            sortOrder: 2 + i,
          },
        });
      }
    }

    // Sync to Numista collection (non-blocking)
    if (formData.addToNumistaCollection && formData.numistaTypeId) {
      try {
        // Find matching issue by year + mint letter
        const issues = formData.numistaIssues as
          | { id: number; year: number; mint_letter?: string }[]
          | null;
        const matchingIssue = issues?.find(
          (i) =>
            i.year === formData.year &&
            (i.mint_letter || "") === (formData.mintMark || "")
        );

        // Map condition to Numista grade format (lowercase)
        let grade: string | undefined;
        if (formData.condition) {
          grade =
            formData.condition === "PROOF"
              ? "unc"
              : formData.condition.toLowerCase();
        }

        const result = await addToNumistaCollection({
          numistaTypeId: formData.numistaTypeId,
          issueId: matchingIssue?.id,
          grade,
        });

        await prisma.coin.update({
          where: { id: coin.id },
          data: { numistaCollectedItemId: result.id },
        });
      } catch (numistaError) {
        console.warn("Failed to add to Numista collection:", numistaError);
      }
    }

    return NextResponse.json(coin, { status: 201 });
  } catch (error) {
    console.error("Failed to save coin:", error);
    return NextResponse.json(
      { error: "Failed to save coin" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "48");
  const country = searchParams.get("country");
  const denomination = searchParams.get("denomination");
  const year = searchParams.get("year");
  const mintMark = searchParams.get("mintMark");
  const condition = searchParams.get("condition");
  const collectionId = searchParams.get("collectionId");
  const material = searchParams.get("material");
  const series = searchParams.get("series");
  const storageLocation = searchParams.get("storageLocation");
  const isProof = searchParams.get("isProof");
  const hasCase = searchParams.get("hasCase");
  const hasCertificate = searchParams.get("hasCertificate");
  const itemType = searchParams.get("itemType");
  const q = searchParams.get("q");

  const where: Record<string, unknown> = {};

  if (itemType) where.itemType = itemType;
  else where.itemType = "coin"; // Default to coins only
  if (country) where.country = country;
  if (denomination) where.denomination = { contains: denomination, mode: "insensitive" };
  if (year) where.year = parseInt(year);
  if (mintMark) where.mintMark = mintMark;
  if (condition) where.condition = condition;
  if (collectionId) where.collectionId = collectionId;
  if (material) where.material = material;
  if (series) where.series = { contains: series, mode: "insensitive" };
  if (storageLocation) where.storageLocation = storageLocation;
  if (isProof === "true") where.isProof = true;
  if (hasCase === "true") where.hasCase = true;
  if (hasCertificate === "true") where.hasCertificate = true;
  if (q) {
    where.OR = [
      { country: { contains: q, mode: "insensitive" } },
      { denomination: { contains: q, mode: "insensitive" } },
      { numistaTitle: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { series: { contains: q, mode: "insensitive" } },
    ];
  }

  const [coins, total] = await Promise.all([
    prisma.coin.findMany({
      where,
      include: { images: { where: { type: "obverse" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.coin.count({ where }),
  ]);

  return NextResponse.json({ coins, total, page, pageSize });
}
