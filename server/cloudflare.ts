import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { deleteCloudinaryFile } from "./cloudinary";

/**
 * Returns an S3Client configured for Cloudflare R2 if credentials are provided in process.env.
 */
export function getR2Client(): S3Client | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const accessKeyId =
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    process.env.R2_ACCESS_KEY_ID ||
    process.env.CLOUDFLARE_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.CLOUDFLARE_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Helper to get the configured Cloudflare R2 bucket name.
 */
export function getR2BucketName(): string {
  return (
    process.env.CLOUDFLARE_R2_BUCKET_NAME ||
    process.env.R2_BUCKET_NAME ||
    process.env.CLOUDFLARE_BUCKET_NAME ||
    process.env.R2_BUCKET ||
    "sellers"
  );
}

/**
 * Parses a Cloudflare R2 / Images object key or image ID from a URL or key string.
 */
export function parseCloudflareKey(fileUrlOrKey: string): {
  key: string;
  isImagesApi?: boolean;
  imageId?: string;
} | null {
  if (!fileUrlOrKey || typeof fileUrlOrKey !== "string") return null;
  const trimmed = fileUrlOrKey.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;

  // Check if it's a full URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);

      // Cloudflare Images: https://imagedelivery.net/<account-hash>/<imageId>/<variant>
      if (url.hostname.includes("imagedelivery.net")) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          const imageId = parts[1];
          return { key: imageId, isImagesApi: true, imageId };
        }
      }

      const bucketName = getR2BucketName();
      let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");

      // If the URL path starts with the bucket name, strip it to get the object key
      if (bucketName && pathname.startsWith(`${bucketName}/`)) {
        pathname = pathname.substring(bucketName.length + 1);
      }

      return { key: pathname };
    } catch {
      return { key: trimmed.replace(/^\/+/, "") };
    }
  }

  // Raw key or path
  return { key: trimmed.replace(/^\/+/, "") };
}

/**
 * Atomic deletion function for Cloudflare Storage (R2 / Images) and compatible CDNs.
 * Parses the object key from the stored Cloudflare URL or key and issues a DeleteObjectCommand (S3 client)
 * or Cloudflare Images API delete request.
 * Errors are handled gracefully so a missing file does not crash the server.
 */
export async function deleteFileFromCloudflare(fileUrlOrKey: string): Promise<void> {
  if (!fileUrlOrKey || typeof fileUrlOrKey !== "string") {
    return;
  }

  const trimmed = fileUrlOrKey.trim();
  if (!trimmed || trimmed.startsWith("data:")) {
    // In-memory data URI or empty string has no remote object to delete
    return;
  }

  try {
    // If it's a Cloudinary URL, also clean up from Cloudinary
    if (trimmed.includes("cloudinary.com")) {
      await deleteCloudinaryFile(trimmed);
      return;
    }

    const parsed = parseCloudflareKey(trimmed);
    if (!parsed || !parsed.key) {
      return;
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;

    // 1. Cloudflare Images API deletion
    if (parsed.isImagesApi && parsed.imageId) {
      const apiToken = process.env.CLOUDFLARE_IMAGES_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
      if (accountId && apiToken) {
        try {
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${parsed.imageId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${apiToken}`,
              },
            }
          );
          if (!response.ok) {
            const errText = await response.text();
            console.warn(`[Cloudflare Images] Delete response (${response.status}): ${errText}`);
          } else {
            console.log(`[Cloudflare Images] Successfully deleted image ID: ${parsed.imageId}`);
            return;
          }
        } catch (err: any) {
          console.warn(`[Cloudflare Images] Error purging image ${parsed.imageId}:`, err?.message || err);
        }
      }
    }

    // 2. Cloudflare R2 S3 DeleteObjectCommand
    const s3 = getR2Client();
    const bucketName = getR2BucketName();

    if (s3) {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: parsed.key,
      });
      await s3.send(command);
      console.log(`[Cloudflare R2] Successfully purged object key '${parsed.key}' from bucket '${bucketName}'`);
    } else {
      console.log(`[Cloudflare R2] Credentials not configured; skipped remote S3 delete for key '${parsed.key}'`);
    }
  } catch (error: any) {
    // Graceful error handling: log warning, never crash or throw
    console.warn(`[Cloudflare] Graceful delete notice for '${fileUrlOrKey}':`, error?.message || error);
  }
}

/**
 * Uploads a buffer to Cloudflare R2 if credentials are set.
 * Returns public URL or null if not configured.
 */
export async function uploadToCloudflareR2(
  fileBuffer: Buffer,
  mimeType: string,
  key: string
): Promise<string | null> {
  const s3 = getR2Client();
  if (!s3) return null;

  const bucketName = getR2BucketName();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/+$/, "");

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    });
    await s3.send(command);

    if (publicBaseUrl) {
      return `${publicBaseUrl}/${key}`;
    }
    return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
  } catch (error: any) {
    console.error(`[Cloudflare R2] Upload failed for key '${key}':`, error?.message || error);
    return null;
  }
}
