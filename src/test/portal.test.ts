import { describe, test, expect, beforeEach } from 'vitest';
import { detectPortal, allowsPortalOverride, PORTAL_URLS } from '../config/portal';

const at = (url: string) => {
  const u = new URL(url);
  return { hostname: u.hostname, search: u.search };
};

describe('portal detection', () => {
  beforeEach(() => sessionStorage.clear());

  test('production hostnames pick their portal and ignore ?portal=', () => {
    expect(detectPortal(at(PORTAL_URLS.landing))).toBe('landing');
    expect(detectPortal(at(`${PORTAL_URLS.coach}/?portal=client`))).toBe('coach');
    expect(detectPortal(at(PORTAL_URLS.client))).toBe('client');
    expect(allowsPortalOverride(new URL(PORTAL_URLS.coach).hostname)).toBe(false);
  });

  test('other hosts use ?portal= and remember it for the tab', () => {
    expect(allowsPortalOverride('localhost')).toBe(true);
    expect(detectPortal(at('http://localhost:3000/'))).toBe('landing');
    expect(detectPortal(at('http://localhost:3000/?portal=coach'))).toBe('coach');
    expect(detectPortal(at('http://localhost:3000/'))).toBe('coach');
    expect(detectPortal(at('http://localhost:3000/?portal=bogus'))).toBe('coach');
  });
});
