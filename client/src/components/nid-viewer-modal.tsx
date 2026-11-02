import React from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, X } from "lucide-react";

interface NidViewerModalProps {
  url: string;
  onClose: () => void;
  title?: string;
  sellerName?: string;
  phone?: string;
}

/**
 * Normalizes name and phone to ensure "000", empty, or invalid fallback strings
 * are never displayed on NID documents, showing clean placeholders instead.
 */
export function cleanDisplayValue(
  val: string | undefined | null,
  fallbackPlaceholder: string
): string {
  if (!val) return fallbackPlaceholder;
  const trimmed = String(val).trim();
  if (
    trimmed === "" ||
    trimmed === "0" ||
    trimmed === "000" ||
    /^0+$/.test(trimmed) ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "n/a"
  ) {
    return fallbackPlaceholder;
  }
  return trimmed;
}

export function NidViewerModal({
  url,
  onClose,
  title = "Document Preview",
  sellerName,
  phone,
}: NidViewerModalProps) {
  // If sellerName not passed directly, try extracting from title (e.g. "Name - NID Document")
  const extractedNameFromTitle = title
    ? title.replace(/\s*-\s*NID Document.*$/i, "").trim()
    : "";
  const displayName = cleanDisplayValue(
    sellerName || extractedNameFromTitle,
    "Verified Seller"
  );

  // If phone not passed directly, try extracting from Cloudinary URL (e.g. TEMP_01791151948_1790341371.jpg)
  const phoneMatch = url ? url.match(/TEMP_([^/_]+)_\d+/i) : null;
  const extractedPhoneFromUrl = phoneMatch
    ? decodeURIComponent(phoneMatch[1])
    : "";
  const displayPhone = cleanDisplayValue(
    phone || extractedPhoneFromUrl,
    "Not Provided"
  );

  // If title indicates Profile Photo, skip watermark
  const isProfilePhoto = title?.toLowerCase().includes("profile photo");
  const isNid = !isProfilePhoto;

  const handleDownload = async () => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width || 800;
      canvas.height = img.naturalHeight || img.height || 600;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);

        if (isNid) {
          const boxHeight = Math.max(72, Math.round(canvas.height * 0.1));
          const overlayY = Math.max(0, canvas.height - boxHeight);

          // Watermark bar at bottom matching server-side stampTextOnImage
          ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
          ctx.fillRect(0, overlayY, canvas.width, boxHeight);

          const fontSize = Math.max(16, Math.round(boxHeight * 0.28));
          ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
          ctx.fillStyle = "#facc15";
          ctx.fillText(
            `Name: ${displayName}`,
            16,
            overlayY + Math.round(boxHeight * 0.42)
          );
          ctx.fillText(
            `Phone: ${displayPhone}`,
            16,
            overlayY + Math.round(boxHeight * 0.82)
          );
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) throw new Error("Canvas blob creation failed");
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `${displayName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}-${isNid ? "nid" : "photo"}.jpg`;
            a.click();
            URL.revokeObjectURL(blobUrl);
          },
          "image/jpeg",
          0.95
        );
        return;
      }
    } catch {
      // Fallback direct download
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        a.click();
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(url, "_blank");
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="overlay-nid-modal"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold truncate">
            <FileText className="h-4 w-4 text-violet-500 shrink-0" />
            <span className="truncate">{title}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 px-2.5"
              onClick={handleDownload}
              data-testid="button-nid-modal-download"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1"
              data-testid="button-nid-modal-close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-auto flex-1 flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="relative rounded-md shadow-md overflow-hidden max-w-full">
            <img
              src={url}
              alt={title}
              style={{ maxWidth: "100%", height: "auto" }}
              className="block rounded-md"
              data-testid="img-nid-preview"
            />
            {/* Watermark overlay at bottom of NID document only */}
            {isNid && (
              <div
                className="absolute bottom-0 left-0 right-0 bg-black/75 px-3 py-2 text-xs flex flex-col gap-0.5 border-t border-black/40 backdrop-blur-[1px]"
                data-testid="nid-watermark-overlay"
              >
                <div className="font-bold text-yellow-400 truncate">
                  Name: {displayName}
                </div>
                <div className="font-bold text-yellow-400 font-mono truncate">
                  Phone: {displayPhone}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NidViewerModal;
