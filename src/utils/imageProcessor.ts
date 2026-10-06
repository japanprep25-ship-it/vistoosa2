/**
 * Client-Side Canvas Image Processing Utility
 * Generates all required PNG variants (16px, 32px, 48px, 180px, 192px, 512px, maskable)
 * completely in the browser with zero native/external node dependencies.
 */

export interface GeneratedVariants {
  'logo-512': string;
  'icon-16': string;
  'icon-32': string;
  'icon-48': string;
  'icon-180': string;
  'icon-192': string;
  'icon-512': string;
  'icon-maskable-512': string;
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to parse uploaded image file.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function renderToCanvas(
  img: HTMLImageElement,
  targetSize: number,
  options: {
    fillWhiteBg?: boolean;
    paddingPercent?: number; // e.g. 0.12 for 12%
    scaleFactor?: number; // e.g. 0.60 for 60%
  } = {}
): string {
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context creation failed.');
  }

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill solid white background for app icons if requested
  if (options.fillWhiteBg) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetSize, targetSize);
  } else {
    ctx.clearRect(0, 0, targetSize, targetSize);
  }

  // Calculate draw dimensions (contain without stretching or cropping)
  const scale = options.scaleFactor || 1;
  const padding = options.paddingPercent || 0;
  const availableWidth = targetSize * (1 - padding * 2) * scale;
  const availableHeight = targetSize * (1 - padding * 2) * scale;

  const imgAspect = img.width / img.height;
  let drawWidth = availableWidth;
  let drawHeight = availableHeight;

  if (imgAspect > 1) {
    drawHeight = availableWidth / imgAspect;
  } else {
    drawWidth = availableHeight * imgAspect;
  }

  const dx = (targetSize - drawWidth) / 2;
  const dy = (targetSize - drawHeight) / 2;

  ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

  return canvas.toDataURL('image/png');
}

export function generateAllLogoVariants(img: HTMLImageElement): GeneratedVariants {
  return {
    // 1. In-app main logo (keeps transparency if present, 5% padding)
    'logo-512': renderToCanvas(img, 512, { fillWhiteBg: false, paddingPercent: 0.05 }),

    // 2. Favicons & App Icons (Solid white background, centered with 12% padding)
    'icon-16': renderToCanvas(img, 16, { fillWhiteBg: true, paddingPercent: 0.12 }),
    'icon-32': renderToCanvas(img, 32, { fillWhiteBg: true, paddingPercent: 0.12 }),
    'icon-48': renderToCanvas(img, 48, { fillWhiteBg: true, paddingPercent: 0.12 }),
    'icon-180': renderToCanvas(img, 180, { fillWhiteBg: true, paddingPercent: 0.12 }),
    'icon-192': renderToCanvas(img, 192, { fillWhiteBg: true, paddingPercent: 0.12 }),
    'icon-512': renderToCanvas(img, 512, { fillWhiteBg: true, paddingPercent: 0.12 }),

    // 3. Maskable PWA Icon (Solid white background, logo scaled to ~60% centered in safe zone)
    'icon-maskable-512': renderToCanvas(img, 512, { fillWhiteBg: true, paddingPercent: 0, scaleFactor: 0.6 }),
  };
}

export function generateDarkLogoVariant(img: HTMLImageElement): string {
  // Main transparent dark-mode logo
  return renderToCanvas(img, 512, { fillWhiteBg: false, paddingPercent: 0.05 });
}
