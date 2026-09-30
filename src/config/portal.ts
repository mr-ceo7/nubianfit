/**
 * Portal routing: one build serves three sites, chosen by hostname.
 *   <root domain>         → landing (marketing site)
 *   coach.<root domain>   → coach   (Coach OS)
 *   app.<root domain>     → client  (client PWA)
 * Locally (or on *.vercel.app previews) use ?portal=coach|client|landing, remembered per tab.
 */

export type Portal = 'landing' | 'coach' | 'client';

const PORTALS: Portal[] = ['landing', 'coach', 'client'];
const OVERRIDE_KEY = 'nubianfit_portal';

type ViteEnv = { VITE_LANDING_URL?: string; VITE_COACH_URL?: string; VITE_CLIENT_URL?: string };
const env = ((import.meta as unknown as { env?: ViteEnv }).env ?? {}) as ViteEnv;

export const PORTAL_URLS: Record<Portal, string> = {
  landing: env.VITE_LANDING_URL || 'https://nubianfit.xn--jhb4c.com',
  coach: env.VITE_COACH_URL || 'https://coach.nubianfit.xn--jhb4c.com',
  client: env.VITE_CLIENT_URL || 'https://app.nubianfit.xn--jhb4c.com',
};

const hostOf = (url: string) => new URL(url).hostname;

/** True where the hostname can't tell us the portal (dev servers, preview deployments). */
export function allowsPortalOverride(hostname = window.location.hostname): boolean {
  return !Object.values(PORTAL_URLS).some(url => hostOf(url) === hostname);
}

export function detectPortal(location: Pick<Location, 'hostname' | 'search'> = window.location): Portal {
  const { hostname } = location;
  if (hostname === hostOf(PORTAL_URLS.coach)) return 'coach';
  if (hostname === hostOf(PORTAL_URLS.client)) return 'client';
  if (hostname === hostOf(PORTAL_URLS.landing)) return 'landing';

  const requested = new URLSearchParams(location.search).get('portal') as Portal | null;
  try {
    if (requested && PORTALS.includes(requested)) {
      sessionStorage.setItem(OVERRIDE_KEY, requested);
      return requested;
    }
    const remembered = sessionStorage.getItem(OVERRIDE_KEY) as Portal | null;
    if (remembered && PORTALS.includes(remembered)) return remembered;
  } catch {
    // storage unavailable (private mode); fall through
  }
  return 'landing';
}

/** Link to another portal: its own domain in production, ?portal= locally. */
export function portalHref(portal: Portal, params?: Record<string, string>): string {
  const query = new URLSearchParams();
  if (allowsPortalOverride()) {
    query.set('portal', portal);
  }
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.set(k, v);
    });
  }
  const qStr = query.toString();
  const base = allowsPortalOverride() ? window.location.pathname : PORTAL_URLS[portal];
  return qStr ? `${base}?${qStr}` : base;
}
