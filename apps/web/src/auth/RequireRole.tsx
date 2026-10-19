import type { Role } from '@civiclink/shared';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '../components/ui';
import { ForbiddenPage } from '../pages/common/ForbiddenPage';
import { useAuth } from './AuthProvider';

/**
 * Client-side route guard (UX only). The real enforcement is server-side in Security Rules
 * and Cloud Functions (NFR-01), so a bypassed guard still yields no data.
 */
export function RequireRole({ roles }: { roles: readonly Role[] | 'any' }) {
  const { session, loading, pendingProfile } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Checking your session" full />;
  if (pendingProfile) return <Navigate to="/welcome" replace />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles !== 'any' && !roles.includes(session.claims.role)) return <ForbiddenPage />;
  return <Outlet />;
}
