import { environment } from './environment';

declare global {
  interface Window {
    fbq?: FacebookPixel;
    _fbq?: FacebookPixel;
  }
}

type FacebookPixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

const TEST_EVENT_CODE = environment.facebookTestEventCode || 'TEST88929';

function eventOptions(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const options: Record<string, unknown> = { ...extra };
  if (TEST_EVENT_CODE) {
    options['test_event_code'] = TEST_EVENT_CODE;
  }
  return options;
}

/** Load Meta Pixel once, then init with the configured Pixel ID. */
export function ensureFacebookPixel(): boolean {
  const pixelId = environment.facebookPixelId?.trim();
  if (!pixelId || typeof window === 'undefined') {
    return false;
  }

  if (typeof window.fbq === 'function') {
    window.fbq('init', pixelId);
    return true;
  }

  const fbq: FacebookPixel = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue = fbq.queue || [];
      fbq.queue.push(args);
    }
  };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  const first = document.getElementsByTagName('script')[0];
  first?.parentNode?.insertBefore(script, first);

  window.fbq('init', pixelId);
  return true;
}

export function trackFacebookEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  extraOptions: Record<string, unknown> = {},
): void {
  if (!ensureFacebookPixel() || typeof window.fbq !== 'function') {
    return;
  }
  window.fbq('track', eventName, params, eventOptions(extraOptions));
}

/** Path screen: fire when a mapped career path is shown (for Meta Events Manager testing). */
export function trackPathScreenView(input: {
  fromId: string;
  toId: string;
  fromTitle?: string;
  toTitle?: string;
  via?: string | null;
}): void {
  const contentName = [input.fromTitle || input.fromId, input.toTitle || input.toId]
    .filter(Boolean)
    .join(' → ');

  trackFacebookEvent('ViewContent', {
    content_name: contentName,
    content_category: 'career_path',
    content_ids: [input.fromId, input.toId].filter(Boolean),
    content_type: 'product',
    ...(input.via ? { via: input.via } : {}),
  });
}

/** Path screen entry PageView with the same test_event_code. */
export function trackPathPageView(): void {
  trackFacebookEvent('PageView');
}
