import { MapPinOff } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
      <MapPinOff className="size-12 text-slate-400" aria-hidden />
      <h1 className="text-xl font-bold text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-600">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="font-semibold text-brand-700 hover:underline">
        Back to CivicLink
      </Link>
    </div>
  );
}
