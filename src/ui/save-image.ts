/** Matches mobile game layouts in style.css */
export const MOBILE_LAYOUT_MEDIA =
  '(max-width: 1280px) and (orientation: portrait), (max-width: 1280px) and (orientation: landscape)';

export function isMobileLayout(): boolean {
  return window.matchMedia(MOBILE_LAYOUT_MEDIA).matches;
}

function downloadViaAnchor(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toJpegFile(blob: Blob, filename: string): File {
  const name = /\.jpe?g$/i.test(filename) ? filename : `${filename.replace(/\.[^.]+$/, '')}.jpg`;
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
}

function canShareImageFile(file: File): boolean {
  if (!navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Saves a JPEG to the device. On phones, opens the native share sheet so the user can
 * choose Save Image (iOS) or a gallery/files app (Android). Desktop uses a direct download.
 */
export async function saveImageBlob(blob: Blob, filename: string): Promise<void> {
  const file = toJpegFile(blob, filename);

  if (isMobileLayout() && canShareImageFile(file)) {
    try {
      await navigator.share({
        files: [file],
        title: 'Toy Mondrian',
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
    }
  }

  downloadViaAnchor(blob, file.name);
}
