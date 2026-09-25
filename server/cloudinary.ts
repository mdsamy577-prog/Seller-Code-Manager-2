import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

if (process.env.CLOUDINARY_URL) {
  cloudinary.config();
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function stampTextOnImage(
  fileBuffer: Buffer,
  sellerName: string,
  phone: string
): Promise<Buffer> {
  const metadata = await sharp(fileBuffer).metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 600;

  const boxHeight = 72;
  const overlayY = Math.max(0, height - boxHeight);

  const svgText = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${boxHeight}">
  <rect width="${width}" height="${boxHeight}" fill="rgba(0,0,0,0.72)" />
  <text x="14" y="26" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#facc15">Name: ${escapeXml(sellerName)}</text>
  <text x="14" y="56" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#facc15">Phone: ${escapeXml(phone)}</text>
</svg>`;

  const overlayBuffer = Buffer.from(svgText);

  return sharp(fileBuffer)
    .composite([{ input: overlayBuffer, top: overlayY, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function uploadNidFile(
  fileBuffer: Buffer,
  mimeType: string,
  publicId: string,
  sellerName: string,
  phone: string
): Promise<string> {
  const stampedBuffer = await stampTextOnImage(fileBuffer, sellerName, phone);

  const isConfigured = !!(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );

  if (!isConfigured) {
    console.warn("[Storage] Cloudinary not configured — using base64 data URI fallback for NID");
    return `data:image/jpeg;base64,${stampedBuffer.toString("base64")}`;
  }

  const cleanPublicId = publicId ? publicId.replace(/\.[^/.]+$/, "") : `nid_${Date.now()}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "nid_documents",
        public_id: cleanPublicId,
        resource_type: "image",
        format: "jpg",
        overwrite: true,
        access_mode: "public",
      },
      (error, result) => {
        if (error) {
          console.error("[Cloudinary] NID upload stream error:", error);
          return reject(error);
        }
        if (!result?.secure_url) {
          return reject(new Error("No secure_url returned from Cloudinary"));
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(stampedBuffer);
  });
}

export async function uploadProfilePhoto(
  fileBuffer: Buffer,
  mimeType: string,
  publicId?: string
): Promise<string> {
  const processedBuffer = await sharp(fileBuffer)
    .resize(500, 500, { fit: "cover", position: "center" })
    .jpeg({ quality: 90 })
    .toBuffer();

  const isConfigured = !!(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );

  if (!isConfigured) {
    console.warn("[Storage] Cloudinary not configured — using base64 data URI fallback for profile photo");
    return `data:image/jpeg;base64,${processedBuffer.toString("base64")}`;
  }

  const cleanPublicId = publicId ? publicId.replace(/\.[^/.]+$/, "") : `profile_${Date.now()}`;

  return new Promise<string>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "seller_profiles",
        public_id: cleanPublicId,
        resource_type: "image",
        format: "jpg",
        overwrite: true,
        access_mode: "public",
      },
      (error, result) => {
        if (error) {
          console.error("[Cloudinary] Profile photo upload error:", error);
          return reject(error);
        }
        if (!result?.secure_url) {
          return reject(new Error("No result from Cloudinary"));
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(processedBuffer);
  });
}

export async function deleteCloudinaryFile(url: string): Promise<void> {
  if (!url || typeof url !== "string") return;
  if (!url.includes("cloudinary.com")) return;
  try {
    const parts = url.split("/upload/");
    if (parts.length < 2) return;
    let pathAfterUpload = parts[1];
    // remove version prefix if present, e.g. "v1234567890/"
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, "");
    // remove file extension, e.g. ".jpg"
    const publicId = pathAfterUpload.replace(/\.[^/.]+$/, "");
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
      console.log(`[Cloudinary] Successfully deleted file: ${publicId}`);
    }
  } catch (e: any) {
    console.error("[Cloudinary] Failed to delete file:", e?.message || e);
  }
}
