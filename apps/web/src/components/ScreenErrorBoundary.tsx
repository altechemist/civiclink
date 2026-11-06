import { RefreshCw, WifiOff } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { Button } from './ui';

interface State {
  error: Error | null;
}

/**
 * FR-34 / DEF-16: a screen whose code is not on the device yet cannot load offline. Instead of a blank page
 * or an endless spinner, explain it and offer a retry. Any other unexpected rendering error gets the same
 * recovery screen rather than a white page.
 */
export class ScreenErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Screen failed to load', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const offline = !navigator.onLine || /dynamically imported module|Failed to fetch|Loading chunk|Importing a module script failed/i.test(this.state.error.message);
    return (
      <div role="alert" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center" data-testid="screen-error">
        <WifiOff className="size-10 text-slate-400" aria-hidden />
        <h1 className="text-lg font-bold text-slate-900">{offline ? "This screen isn't available offline yet" : 'Something went wrong on this screen'}</h1>
        <p className="text-sm text-slate-600">
          {offline
            ? 'Connect to the internet once and open it again; after that it also works offline. Screens you have already opened still work.'
            : 'Please try again. If it keeps happening, go back to the home screen.'}
        </p>
        <div className="flex gap-2">
          <Button icon={RefreshCw} onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Button variant="secondary" onClick={() => window.location.assign('/')}>
            Home
          </Button>
        </div>
      </div>
    );
  }
}
