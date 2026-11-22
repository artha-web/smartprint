import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UTApi } from "uploadthing/server";
import fs from "fs/promises";
import path from "path";

// 1. UploadThing Configuration (Primary if UPLOADTHING_TOKEN is provided)
const uploadthingToken = process.env.UPLOADTHING_TOKEN || process.env.UPLOADTHING_SECRET;
let utApi: UTApi | null = null;
if (uploadthingToken) {
  utApi = new UTApi({ token: uploadthingToken });
}

// 2. Cloudflare R2 Configuration (S3-Compatible)
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || "stationery-documents";

let s3Client: S3Client | null = null;
if (r2AccountId && r2AccessKeyId && r2SecretAccessKey) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });
}

// 3. Local filesystem fallback directory for development
const LOCAL_STORAGE_DIR = path.join(process.cwd(), ".storage");

export function getActiveStorageProvider(): "uploadthing" | "r2" | "local" {
  if (utApi) return "uploadthing";
  if (s3Client) return "r2";
  return "local";
}

/**
 * Generates direct S3/R2 presigned URL for single-hop browser uploads
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string | null> {
  if (!s3Client) return null;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes
}

export interface UploadResult {
  storageKey: string;
  fileUrl?: string;
}

export async function uploadFile(
  key: string,
  buffer: Uint8Array,
  contentType: string,
  originalFilename = "document"
): Promise<UploadResult> {
  // If UploadThing is configured
  if (utApi) {
    const file = new File([buffer as unknown as BlobPart], originalFilename, { type: contentType });
    const response = await utApi.uploadFiles(file);

    if (response.error || !response.data) {
      throw new Error(`UploadThing error: ${response.error?.message || "Failed to upload to UploadThing"}`);
    }

    return {
      storageKey: `uploadthing:${response.data.key}`,
      fileUrl: response.data.url,
    };
  }

  // If Cloudflare R2 is configured
  if (s3Client) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return { storageKey: key };
  }

  // Local filesystem fallback
  const fullPath = path.join(LOCAL_STORAGE_DIR, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  return { storageKey: key };
}

export async function getFile(
  key: string
): Promise<{ stream: ReadableStream | NodeJS.ReadableStream | Uint8Array; contentType: string } | null> {
  // Handle UploadThing stored files
  if (key.startsWith("uploadthing:")) {
    const utKey = key.replace("uploadthing:", "");
    try {
      const fileUrl = `https://utfs.io/f/${utKey}`;
      const res = await fetch(fileUrl);
      if (!res.ok) return null;

      const arrayBuffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "application/octet-stream";
      return {
        stream: new Uint8Array(arrayBuffer),
        contentType,
      };
    } catch (e) {
      console.error("Failed to retrieve file from UploadThing:", e);
      return null;
    }
  }

  // Handle Cloudflare R2 stored files
  if (s3Client) {
    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
      );

      if (!response.Body) return null;

      return {
        stream: response.Body as unknown as ReadableStream,
        contentType: response.ContentType || "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  // Handle Local filesystem fallback
  const fullPath = path.join(LOCAL_STORAGE_DIR, key);
  try {
    const data = await fs.readFile(fullPath);
    const ext = path.extname(key).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".pdf") contentType = "application/pdf";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".webp") contentType = "image/webp";
    else if (ext === ".docx") contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (ext === ".txt") contentType = "text/plain";

    return {
      stream: data,
      contentType,
    };
  } catch {
    return null;
  }
}

/**
 * Permanently deletes the file from storage (UploadThing, R2, or local disk).
 */
export async function deleteFile(key: string): Promise<boolean> {
  // Delete from UploadThing
  if (key.startsWith("uploadthing:")) {
    const utKey = key.replace("uploadthing:", "");
    if (utApi) {
      try {
        await utApi.deleteFiles(utKey);
        return true;
      } catch (e) {
        console.error(`Failed to delete UploadThing file ${utKey}:`, e);
        return false;
      }
    }
    return true;
  }

  // Delete from Cloudflare R2
  if (s3Client) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
      );
      return true;
    } catch (e) {
      console.error(`Failed to delete R2 object: ${key}`, e);
      return false;
    }
  }

  // Delete from Local filesystem
  const fullPath = path.join(LOCAL_STORAGE_DIR, key);
  try {
    await fs.unlink(fullPath);
    return true;
  } catch {
    return false;
  }
}
