import { useEffect, useId, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_ID = 'cf-turnstile-script';

let scriptPromise: Promise<void> | null = null;

/** Load the Turnstile script once, no matter how many widgets mount. */
function loadTurnstile(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('turnstile failed')));
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile failed'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

interface Props {
  siteKey: string;
  onToken: (token: string) => void;
  /** Light theme to match the page; dark for the maroon footer. */
  theme?: 'light' | 'dark';
  action?: string;
}

/**
 * Cloudflare Turnstile widget.
 *
 * Chosen over reCAPTCHA/hCaptcha because it is free, native to the deployment
 * platform, and does not profile users — which matters on a site whose forms are
 * frequently completed by minors.
 *
 * The token is single-use: after a submission the widget must be reset, which the
 * parent does by bumping `resetKey` (remounting this component).
 */
export default function Turnstile({ siteKey, onToken, theme = 'light', action }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const fallbackId = useId();

  // Keep the latest callback without re-rendering the widget.
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          action,
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
          'refresh-expired': 'auto',
        });
      })
      .catch(() => {
        // Script blocked or offline. Leave the token empty; the server rejects
        // the submission and the form shows its error state with the phone
        // number, which is the documented fallback path.
        if (!cancelled) onTokenRef.current('');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget already torn down */
        }
      }
    };
  }, [siteKey, theme, action]);

  if (!siteKey) {
    // No key configured (local dev without .dev.vars). Render nothing rather than
    // an empty box; the server-side check still runs and will reject.
    return null;
  }

  return <div ref={containerRef} id={fallbackId} className="mt-4" />;
}
