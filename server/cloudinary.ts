import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

  // 1. Try Cloudflare R2 if configured
  const hasR2 = !!(
    (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID) &&
    (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY_ID) &&
    (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SECRET_ACCESS_KEY)
  );

  if (hasR2) {
    try {
      const { uploadToCloudflareR2 } = await import("./cloudflare");
      const r2Key = `nid_uploads/${publicId}.jpg`;
      const r2Url = await uploadToCloudflareR2(stampedBuffer, "image/jpeg", r2Key);
      if (r2Url) {
        return r2Url;
      }
    } catch (r2Err) {
      console.warn("[Cloudflare R2] NID upload failed, checking fallbacks:", r2Err);
    }
  }

  // 2. Try Cloudinary if configured
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.log("[Storage] Cloudinary & R2 not set — using base64 data URI fallback for NID");
    return `data:image/jpeg;base64,${stampedBuffer.toString("base64")}`;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: "nid_uploads",
        resource_type: "image",
        type: "upload",
        access_mode: "public",
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("No result from Cloudinary"));
        resolve(result.secure_url);
      }
    );
    uploadStream.end(stampedBuffer);
  });
}

export async function uploadProfilePhoto(
  fileBuffer: Buffer,
  mimeType: string,
  publicId: string
): Promise<string> {
  const processedBuffer = await sharp(fileBuffer)
    .resize(500, 500, { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();

  // 1. Try Cloudinary if configured
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    try {
      return await new Promise<string>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            folder: "seller_photos",
            resource_type: "image",
            type: "upload",
            access_mode: "public",
            overwrite: true,
          },
          (error, result) => {
            if (error) return reject(error);
            if (!result) return reject(new Error("No result from Cloudinary"));
            resolve(result.secure_url);
          }
        );
        uploadStream.end(processedBuffer);
      });
    } catch (cErr) {
      console.warn("[Cloudinary] Profile photo upload failed, checking fallbacks:", cErr);
    }
  }

  // 2. Try Cloudflare R2 if configured
  const hasR2 = !!(
    (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID) &&
    (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY_ID) &&
    (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SECRET_ACCESS_KEY)
  );

  if (hasR2) {
    try {
      const { uploadToCloudflareR2 } = await import("./cloudflare");
      const r2Key = `seller_photos/${publicId}.jpg`;
      const r2Url = await uploadToCloudflareR2(processedBuffer, "image/jpeg", r2Key);
      if (r2Url) {
        return r2Url;
      }
    } catch (r2Err) {
      console.warn("[Cloudflare R2] Profile photo upload failed, checking fallbacks:", r2Err);
    }
  }

  // 3. Fallback: Base64 data URI
  console.log("[Storage] Cloudinary & R2 not set — using base64 data URI fallback for profile photo");
  return `data:image/jpeg;base64,${processedBuffer.toString("base64")}`;
}

export async function deleteCloudinaryFile(url: string): Promise<void> {
  try {
    const parts = url.split("/");
    const vIdx = parts.findIndex((p) => /^v\d+$/.test(p));
    if (vIdx === -1) return;
    const withExt = parts.slice(vIdx + 1).join("/");
    const publicId = withExt.replace(/\.[^.]+$/, "");
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (e) {
    console.error("Failed to delete Cloudinary file:", e);
  }
}
