import type { DepartmentDoc, ReportDoc } from '@civiclink/shared';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { useSession } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { useLiveQuery } from '../../lib/hooks';

/** Officials see their department's reports (BR-20); admins see all. Queries match the Security Rules. */
export function useStaffReports() {
  const { claims } = useSession();
  const isAdmin = claims.role === 'ADMIN';
  const q = isAdmin
    ? query(collection(db, 'reports'), orderBy('createdAt', 'desc'))
    : query(collection(db, 'reports'), where('departmentId', '==', claims.dept ?? '-'), orderBy('createdAt', 'desc'));
  return useLiveQuery<ReportDoc>(q, `staff-reports-${isAdmin ? 'all' : claims.dept}`);
}

export function useDepartments() {
  return useLiveQuery<DepartmentDoc>(query(collection(db, 'departments'), orderBy('name')), 'departments');
}
