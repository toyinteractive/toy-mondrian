type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

export type AnalyticsEvent =
  | 'play'
  | 'restart'
  | 'download_open'
  | 'download_svg'
  | 'download_image'
  | 'download_image_share'
  | 'sfx_mute'
  | 'sfx_unmute';

export function trackEvent(eventName: AnalyticsEvent): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }
  window.gtag('event', eventName);
}
