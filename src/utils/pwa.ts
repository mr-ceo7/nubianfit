/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Interface for BeforeInstallPromptEvent
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners: Array<(prompt: BeforeInstallPromptEvent | null) => void> = [];

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.log('[PWA] Service Worker registration failed:', err);
        });
    });
  } else if ('serviceWorker' in navigator) {
    // Development registration for instant testing
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Dev Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.log('[PWA] Dev SW init:', err);
      });
  }

  // Capture install prompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((listener) => listener(deferredPrompt));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((listener) => listener(null));
    console.log('[PWA] Application successfully installed');
  });
}

export function subscribeToInstallPrompt(callback: (prompt: BeforeInstallPromptEvent | null) => void) {
  listeners.push(callback);
  callback(deferredPrompt);
  return () => {
    const index = listeners.indexOf(callback);
    if (index !== -1) listeners.splice(index, 1);
  };
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    listeners.forEach((l) => l(null));
    return outcome === 'accepted';
  } catch (err) {
    console.error('[PWA] Error showing install prompt:', err);
    return false;
  }
}

export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error - iOS Safari specific property
    window.navigator.standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}
