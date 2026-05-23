import imageCompression from "browser-image-compression";

// Resize + re-encode user-picked images in the browser before upload.
//
// HEIC strategy: we don't handle HEIC client-side. The `<input accept>` on
// the picker omits HEIC, which triggers iOS Safari's documented behavior of
// converting HEIC photos to JPEG on selection. This covers 99% of HEIC files
// in practice (they come from iPhones). The remaining 1% (HEIC AirDropped
// to Windows + uploaded in Chrome) get rejected at the picker — same as
// Instagram / Shopify / Vinted handle it.
//
// Server still re-processes via sharp — this is the UX layer.

const PHOTO_TARGET_MB = 1;
const PHOTO_MAX_EDGE_PX = 1024;

export async function compressPhotoForUpload(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: PHOTO_TARGET_MB,
    maxWidthOrHeight: PHOTO_MAX_EDGE_PX,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.85,
  });

  if (compressed instanceof File) return compressed;

  return new File([compressed], renameToJpg(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function renameToJpg(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot === -1 ? name : name.slice(0, dot);
  return `${base || "photo"}.jpg`;
}
