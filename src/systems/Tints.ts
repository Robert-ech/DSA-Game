import Phaser from 'phaser';

/**
 * Phaser's tint is multiplicative, so tinting the blue ice dragons red or
 * yellow directly goes muddy. Instead: bake a grayscale copy of the source
 * texture once, colorize it with the theme color, and register the result as
 * its own texture key. Returns the key (cached across calls).
 */
export function ensureTintedTexture(
  scene: Phaser.Scene,
  baseKey: string,
  color: number,
): string {
  const key = `${baseKey}_tint_${color.toString(16).padStart(6, '0')}`;
  if (scene.textures.exists(key)) return key;

  const source = scene.textures.get(baseKey).getSourceImage() as
    | HTMLImageElement
    | HTMLCanvasElement;
  const width = source.width;
  const height = source.height;

  const canvasTexture = scene.textures.createCanvas(key, width, height);
  if (!canvasTexture) return baseKey;
  const ctx = canvasTexture.getContext();
  ctx.drawImage(source, 0, 0);

  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;

  const img = ctx.getImageData(0, 0, width, height);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    // luminance-weighted grayscale, then multiply by the theme color
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = Math.min(255, gray * r * 1.35); // slight boost keeps darks readable
    px[i + 1] = Math.min(255, gray * g * 1.35);
    px[i + 2] = Math.min(255, gray * b * 1.35);
  }
  ctx.putImageData(img, 0, 0);
  canvasTexture.refresh();
  return key;
}
