'use client';

/**
 * Prepares a photo for upload from a phone:
 *  - HEIC/HEIF (iPhone) → JPEG (native decode when the browser can, heic2any otherwise)
 *  - large photos are scaled down (longest side ≤ maxSide) and re-encoded as JPEG
 *  - EXIF orientation is applied, so photos don't come out sideways
 * Anything that isn't a still image (video, PDF, GIF, SVG) is returned unchanged.
 * Never throws: on any failure the original file is returned.
 */
export const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
export const isImageLike = (f: File) => f.type.startsWith('image/') || isHeic(f);

export async function prepareImage(file: File, { maxSide = 1920, quality = 0.82, skipBelow = 600 * 1024 } = {}): Promise<File> {
  if (!isImageLike(file) || /image\/(gif|svg)/i.test(file.type)) return file;
  const heic = isHeic(file);
  try {
    let source: Blob = file;
    let bmp: ImageBitmap | null = null;
    try {
      bmp = await createImageBitmap(source, { imageOrientation: 'from-image' });
    } catch {
      if (!heic) return file;
      const { default: heic2any } = await import('heic2any');
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality });
      source = Array.isArray(out) ? out[0] : out;
      bmp = await createImageBitmap(source, { imageOrientation: 'from-image' });
    }
    const big = Math.max(bmp.width, bmp.height) > maxSide;
    if (!heic && !big && file.size <= skipBelow) { bmp.close(); return file; }
    const scale = big ? maxSide / Math.max(bmp.width, bmp.height) : 1;
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bmp.close(); return file; }
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // PNG transparency → white instead of black
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob) return file;
    if (!heic && blob.size >= file.size) return file; // re-encoding didn't help
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export const prepareImages = (files: File[], opts?: Parameters<typeof prepareImage>[1]) => Promise.all(files.map((f) => prepareImage(f, opts)));

/** Replace the files of an <input type=file> (so a normal form submit sends the prepared versions) */
export function setInputFiles(input: HTMLInputElement, files: File[]) {
  try { const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); input.files = dt.files; } catch { /* unsupported */ }
}
