import imageCompression from "browser-image-compression";

// Compress + re-encode user-picked images in the browser before upload.
//
// Why this exists:
//   • Phone gallery shots are 3–12 MB; an avatar renders at ~200x200. Sending
//     the original wastes the user's data and our bandwidth/storage.
//   • iPhone HEIC isn't accepted by every browser <img> and would 415 the
//     backend if it slipped through. Transparent decode → JPEG fixes both.
//   • Iterative quality search means we cannot produce an over-budget file.
//
// The server still re-processes through sharp — this is the UX layer (fast
// uploads, no surprise rejections), not the security layer.

const PHOTO_TARGET_MB = 1;
const PHOTO_MAX_EDGE_PX = 1024;

export async function compressPhotoForUpload(file: File): Promise<File> {
  // HEIC isn't decodable by canvas on Chrome / Firefox / Android — decode it
  // to JPEG first via heic-to (wasm libheif) so the rest of the pipeline can
  // treat it like any other JPEG. Dynamic import keeps the ~1MB wasm out of
  // the initial bundle for the 90%+ of users who never pick a HEIC.
  const input = isHeic(file) ? await decodeHeicToJpeg(file) : file;

  // No fast-path: even small JPEGs go through canvas re-encode. The earlier
  // size-skip shortcut leaked EXIF (GPS, device, capture time) into the
  // upload request — visible to any proxy/CDN logging request bodies even
  // though the server later strips it. Canvas round-trip is cheap (<50ms
  // for sub-MB JPEGs) and worth the privacy guarantee.
  const compressed = await imageCompression(input, {
    maxSizeMB: PHOTO_TARGET_MB,
    maxWidthOrHeight: PHOTO_MAX_EDGE_PX,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.85,
  });

  // imageCompression sometimes returns a Blob — normalize to File so the
  // upload path (FormData append) keeps a sensible filename downstream.
  if (compressed instanceof File) return compressed;

  return new File([compressed], renameToJpg(input.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

// HEIC sometimes arrives with a blank or generic MIME (iOS share extensions,
// the "Files" app, certain Android camera apps) — check the extension too.
function isHeic(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "image/heic" || t === "image/heif") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

async function decodeHeicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import("heic-to");
  const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
  return new File([blob], renameToJpg(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function renameToJpg(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot === -1 ? name : name.slice(0, dot);
  return `${base || "photo"}.jpg`;
}
