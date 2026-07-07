/**
 * Compresses a base64 image using canvas.
 * Resizes to maxWidth and re-encodes as JPEG at the given quality.
 * Returns the original string unchanged if it's not a data URL.
 */
export async function compressImage(
  base64: string,
  maxWidth = 800,
  quality = 0.65
): Promise<string> {
  if (!base64 || !base64.startsWith('data:image')) return base64;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

/**
 * Compresses a base64 image to stay under a given byte size.
 * Reduces quality progressively until it fits.
 */
export async function compressToSize(
  base64: string,
  maxBytes = 200_000, // 200 KB
  maxWidth = 800
): Promise<string> {
  let result = await compressImage(base64, maxWidth, 0.7);
  let quality = 0.7;
  while (result.length > maxBytes && quality > 0.15) {
    quality -= 0.1;
    result = await compressImage(base64, maxWidth, quality);
  }
  return result;
}
