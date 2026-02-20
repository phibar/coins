import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: process.env.COINS_AWS_REGION!,
  credentials: {
    accessKeyId: process.env.COINS_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.COINS_AWS_SECRET_ACCESS_KEY!,
  },
});

export const BUCKET = process.env.S3_BUCKET_NAME!;

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return getS3Url(key);
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

export function getS3Url(key: string): string {
  return `/api/images/s3?key=${encodeURIComponent(key)}`;
}
