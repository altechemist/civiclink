import { ShieldX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { HOME, useAuth } from '../../auth/AuthProvider';

/** Permission-denied state (NFR-01, E2E-04). Shown when a signed-in user opens another role's area. */
export function ForbiddenPage() {
  const { session } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center" data-testid="forbidden">
      <ShieldX className="size-12 text-red-500" aria-hidden />
      <h1 className="text-xl font-bold text-slate-900">You don't have access to this page</h1>
      <p className="max-w-sm text-sm text-slate-600">
        This area is for a different type of account. If you believe this is a mistake, contact the municipality's system administrator.
      </p>
      <Link to={session ? HOME[session.claims.role] : '/login'} className="mt-2 font-semibold text-brand-700 hover:underline">
        Go to my home page
      </Link>
    </div>
  );
}
