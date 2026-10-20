import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { call } from './api';
import { app } from './firebase';

/** FR-24: web push on this device. Hidden unless a VAPID key is configured (deployed site only). */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const STORAGE_KEY = 'civiclink.pushToken';

export async function pushAvailable(): Promise<boolean> {
  return !!VAPID_KEY && 'serviceWorker' in navigator && 'Notification' in window && (await isSupported().catch(() => false));
}

export const pushEnabledHere = () => !!localStorage.getItem(STORAGE_KEY) && Notification.permission === 'granted';

/** Asks permission, subscribes via the app's service worker and registers the token with the API. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in your browser settings.');
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error('This browser could not create a push subscription.');
  await call('registerPushToken', { token });
  localStorage.setItem(STORAGE_KEY, token);
}

export async function disablePush(): Promise<void> {
  const token = localStorage.getItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
  if (token) await call('unregisterPushToken', { token }).catch(() => {});
}
