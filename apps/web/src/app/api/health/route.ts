import { NextResponse } from "next/server";
import { s3Client, BUCKET } from "@/lib/s3";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { searchTypes } from "@/lib/numista";

interface ServiceStatus {
  name: string;
  status: "ok" | "error";
  message?: string;
  details?: Record<string, string>;
}

export async function GET() {
  const results: ServiceStatus[] = await Promise.all([
    // Camera service
    checkCamera(),
    // AWS S3
    checkS3(),
    // Numista API
    checkNumista(),
    // Database
    checkDatabase(),
  ]);

  const allOk = results.every((r) => r.status === "ok");

  return NextResponse.json(
    { services: results, allOk },
    { status: allOk ? 200 : 207 }
  );
}

async function checkCamera(): Promise<ServiceStatus> {
  try {
    const url = process.env.CAMERA_SERVICE_URL || "http://localhost:3001";
    const res = await fetch(`${url}/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      name: "camera",
      status: "ok",
      details: {
        model: data.model || "Unknown",
        connected: String(data.connected),
      },
    };
  } catch (e) {
    return {
      name: "camera",
      status: "error",
      message: e instanceof Error ? e.message : "Nicht erreichbar",
    };
  }
}

async function checkS3(): Promise<ServiceStatus> {
  if (!process.env.COINS_AWS_ACCESS_KEY_ID || !process.env.S3_BUCKET_NAME) {
    return {
      name: "s3",
      status: "error",
      message: "AWS-Zugangsdaten oder Bucket-Name nicht konfiguriert",
    };
  }

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return {
      name: "s3",
      status: "ok",
      details: {
        bucket: BUCKET,
        region: process.env.COINS_AWS_REGION || "unknown",
      },
    };
  } catch (e) {
    return {
      name: "s3",
      status: "error",
      message: e instanceof Error ? e.message : "S3-Verbindung fehlgeschlagen",
    };
  }
}

async function checkNumista(): Promise<ServiceStatus> {
  if (!process.env.NUMISTA_API_KEY) {
    return {
      name: "numista",
      status: "error",
      message: "NUMISTA_API_KEY nicht konfiguriert",
    };
  }

  try {
    const result = await searchTypes({ q: "test", count: 1 });
    return {
      name: "numista",
      status: "ok",
      details: { resultCount: String(result.count) },
    };
  } catch (e) {
    return {
      name: "numista",
      status: "error",
      message: e instanceof Error ? e.message : "Numista-API nicht erreichbar",
    };
  }
}

async function checkDatabase(): Promise<ServiceStatus> {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    return { name: "database", status: "ok" };
  } catch (e) {
    return {
      name: "database",
      status: "error",
      message: e instanceof Error ? e.message : "Datenbankverbindung fehlgeschlagen",
    };
  }
}
