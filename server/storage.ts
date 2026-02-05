import { ENV } from './_core/env';
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageConfig = { baseUrl: string; apiKey: string };

let s3Client: S3Client | null = null;

function getS3Client() {
  if (s3Client) return s3Client;
  if (ENV.awsAccessKeyId && ENV.awsSecretAccessKey) {
    s3Client = new S3Client({
      region: ENV.awsRegion || "us-east-1",
      credentials: {
        accessKeyId: ENV.awsAccessKeyId,
        secretAccessKey: ENV.awsSecretAccessKey,
      },
    });
    return s3Client;
  }
  return null;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

import fs from "fs";
import path from "path";

// Simulation Fallback
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const s3 = getS3Client();
  const key = normalizeKey(relKey);

  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

  if (s3 && ENV.s3BucketName && !ENV.awsAccessKeyId.includes("DUMMY")) {
    console.log(`[Storage] Uploading ${key} to S3 bucket ${ENV.s3BucketName}`);
    try {
      await s3.send(new PutObjectCommand({
        Bucket: ENV.s3BucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }));

      const url = await getSignedUrl(s3, new GetObjectCommand({
        Bucket: ENV.s3BucketName,
        Key: key,
      }), { expiresIn: 60 * 60 * 24 * 7 }); // 7 days

      return { key, url };
    } catch (err) {
      console.warn(`[Storage] S3 Upload failed: ${err}. Falling back to simulation.`);
    }
  }

  // Simulation Fallback: Save to local disk so full-alchemy-cycle can find it
  console.log(`[Storage] SIMULATION: Saving '${key}' to local disk.`);
  const simDir = path.join(process.cwd(), "simulated_storage");
  const filePath = path.join(simDir, key);

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  fs.writeFileSync(filePath, body);

  return {
    key,
    url: `http://localhost:${process.env.PORT || 3000}/simulated/${key}`
  };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const s3 = getS3Client();
  const key = normalizeKey(relKey);

  if (s3 && ENV.s3BucketName) {
    const url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: ENV.s3BucketName,
      Key: key,
    }), { expiresIn: 60 * 60 * 24 * 7 });
    return { key, url };
  }

  throw new Error("Storage credentials missing");
}
