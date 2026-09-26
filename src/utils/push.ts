import { notificationsApi } from '../services/apiClient';

/** Web push needs a service worker, which is only registered in production builds. */
export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ?? null;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Ask permission and subscribe this device. Throws with a readable message on failure. */
export async function enablePush(): Promise<void> {
  const reg = await registration();
  if (!reg) throw new Error('Install or open the app from its web address to enable push notifications.');
  const { publicKey } = await notificationsApi.pushKey();
  if (!publicKey) throw new Error('Push notifications are not configured on the server yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings.');
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  await notificationsApi.pushSubscribe(sub.toJSON());
}

export async function disablePush(): Promise<void> {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await notificationsApi.pushUnsubscribe(sub.toJSON()).catch(() => undefined);
  await sub.unsubscribe();
}
