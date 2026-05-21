/**
 * True phone/tablet OS — not viewport width (narrow desktop windows stay on file download).
 * Not perfect (UA can be spoofed) but avoids desktop share sheets on resized browsers.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  if (navigator.userAgentData?.mobile === true) {
    return true;
  }

  const ua = navigator.userAgent;

  if (/\b(iPhone|iPod)\b/i.test(ua)) {
    return true;
  }

  if (/\biPad\b/i.test(ua)) {
    return true;
  }

  // iPadOS 13+ may report as Mac with touch
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return true;
  }

  if (/\bAndroid\b/i.test(ua)) {
    return true;
  }

  return false;
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
 * Saves a JPEG to the device. On phones/tablets, opens the native share sheet so the user can
 * choose Save Image (iOS) or a gallery/files app (Android). Desktop uses a direct download.
 */
export async function saveImageBlob(blob: Blob, filename: string): Promise<void> {
  const file = toJpegFile(blob, filename);

  if (isMobileDevice() && canShareImageFile(file)) {
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
