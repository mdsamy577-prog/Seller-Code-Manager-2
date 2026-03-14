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
