import { Download, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui';

/** FR-34: online/offline status of the device. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Shown on every screen while offline: cached screens keep working, changes need a connection. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="fixed inset-x-0 bottom-16 z-[1200] mx-auto flex max-w-md items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg sm:bottom-4"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      You're offline: showing saved information. New reports are kept on this phone and sent when you reconnect.
    </div>
  );
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** The browser's install prompt, captured at start-up in main.tsx. */
export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(() => (window as { __installPrompt?: InstallPromptEvent }).__installPrompt ?? null);
  useEffect(() => {
    const capture = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const installed = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  return event;
}

export function InstallButton() {
  const prompt = useInstallPrompt();
  const [done, setDone] = useState(false);
  if (!prompt || done) return null;
  return (
    <Button
      variant="secondary"
      icon={Download}
      onClick={async () => {
        await prompt.prompt();
        if ((await prompt.userChoice).outcome === 'accepted') setDone(true);
      }}
    >
      Install CivicLink on this phone
    </Button>
  );
}
