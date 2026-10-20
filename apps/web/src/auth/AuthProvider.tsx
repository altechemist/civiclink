import type { Claims, Role, UserDoc } from '@civiclink/shared';
import {
  GoogleAuthProvider,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { call } from '../lib/api';
import { auth, db } from '../lib/firebase';

export interface Session {
  user: User;
  uid: string;
  claims: Claims;
  profile: UserDoc | null;
}

interface AuthState {
  session: Session | null;
  /** Signed in (e.g. first Google sign-in) but no CivicLink profile yet: must complete it (FR-29). */
  pendingProfile: User | null;
  loading: boolean;
  notice: string | null;
  signIn(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  /** FR-39: continue as a guest (anonymous session with a guest Resident profile). */
  startGuest(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  refreshClaims(): Promise<void>;
  signOut(notice?: string): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const HOME: Record<Role, string> = {
  RESIDENT: '/resident',
  OFFICIAL: '/official',
  FIELD_WORKER: '/worker',
  ADMIN: '/official',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims | null>(null);
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const claimsRef = useRef<Claims | null>(null);

  useEffect(
    () =>
      onIdTokenChanged(auth, async (u) => {
        setUser(u);
        if (!u) {
          setClaims(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        const token = await u.getIdTokenResult();
        const c = token.claims as unknown as Claims;
        claimsRef.current = c.role ? c : null;
        setClaims(claimsRef.current);
        setLoading(false);
      }),
    [],
  );

  // Profile listener: when an admin changes this user's role or deactivates them, refresh the token
  // so Security Rules and routing see the new claims immediately (FR-20).
  // Resubscribes once claims exist: a new guest's profile is not readable until its claims are set (FR-39).
  const hasClaims = claims !== null;
  useEffect(() => {
    if (!user || !hasClaims) return;
    return onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      const p = (snap.data() as UserDoc | undefined) ?? null;
      setProfile(p);
      const c = claimsRef.current;
      if (!p) return;
      if (!p.isActive) {
        setNotice('Your account has been deactivated. Contact the municipality for help.');
        await signOut(auth);
        return;
      }
      if (c && (c.role !== p.role || (c.dept ?? null) !== (p.departmentId ?? null))) {
        await user.getIdToken(true);
      }
    }, () => setProfile(null));
  }, [user, hasClaims]);

  const value = useMemo<AuthState>(
    () => ({
      session: user && claims ? { user, uid: user.uid, claims, profile } : null,
      // A guest session gets its profile from startGuest(), never from the welcome step.
      pendingProfile: user && !user.isAnonymous && !claims && !loading ? user : null,
      loading,
      notice,
      async signIn(email, password) {
        setNotice(null);
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await updateDoc(doc(db, 'users', cred.user.uid), { lastLoginAt: serverTimestamp() }).catch(() => {});
      },
      async signInWithGoogle() {
        setNotice(null);
        const cred = await signInWithPopup(auth, new GoogleAuthProvider());
        await updateDoc(doc(db, 'users', cred.user.uid), { lastLoginAt: serverTimestamp() }).catch(() => {});
      },
      async startGuest() {
        setNotice(null);
        const current = auth.currentUser;
        const u = current?.isAnonymous ? current : (await signInAnonymously(auth)).user;
        await call('startGuestSession', {});
        await u.getIdToken(true);
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email);
      },
      async refreshClaims() {
        await auth.currentUser?.getIdToken(true);
      },
      async signOut(message?: string) {
        await signOut(auth);
        if (message) setNotice(message);
      },
    }),
    [user, claims, profile, loading, notice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** For pages behind RequireRole: the session is guaranteed. */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) throw new Error('useSession without a session');
  return session;
}
