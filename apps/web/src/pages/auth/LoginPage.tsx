import { FirebaseError } from 'firebase/app';
import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { HOME, useAuth } from '../../auth/AuthProvider';
import { Button, Field, Input, Notice } from '../../components/ui';
import { useEmulators } from '../../lib/firebase';
import { AuthCard } from './AuthCard';

/** Seeded demo accounts (scripts/seed.ts), shown only when running against the emulator. */
const DEMO_ACCOUNTS = [
  { label: 'Resident', email: 'thandi@civiclink.demo' },
  { label: 'Official (Water)', email: 'naledi@civiclink.demo' },
  { label: 'Field worker', email: 'sipho@civiclink.demo' },
  { label: 'Administrator', email: 'admin@civiclink.demo' },
];
export const DEMO_PASSWORD = 'CivicLink#2026';

function message(err: unknown) {
  const code = err instanceof FirebaseError ? err.code : '';
  if (code === 'auth/user-disabled') return 'This account has been deactivated. Contact the municipality for help.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.';
  if (code === 'auth/network-request-failed') return 'Cannot reach CivicLink. Check your connection.';
  return 'Incorrect email or password.';
}

export function LoginPage() {
  const { session, pendingProfile, signIn, signInWithGoogle, resetPassword, notice } = useAuth();
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (pendingProfile) return <Navigate to="/welcome" replace />;
  if (session) return <Navigate to={HOME[session.claims.role]} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setError(message(err));
    }
  };

  const forgot = async () => {
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter your email address above, then choose "Forgot password?" again.');
    try {
      await resetPassword(email.trim());
    } catch {
      // Same response whether or not the account exists (no account enumeration).
    }
    setInfo(`If an account exists for ${email.trim()}, a password reset link has been sent to it.`);
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Report issues, track progress and receive alerts for your area."
      footer={
        <>
          New to CivicLink?{' '}
          <Link to="/register" className="font-semibold text-white underline">
            Create a resident account
          </Link>
          <span className="mt-2 block">
            <Link to="/transparency" className="font-semibold text-white underline">
              See how the municipality is responding
            </Link>
          </span>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {notice && <Notice tone="warning">{notice}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {info && <Notice tone="success">{info}</Notice>}
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <button type="button" onClick={forgot} className="text-sm font-medium text-brand-700 hover:underline">
            Forgot password?
          </button>
        </div>
        <Button type="submit" busy={busy} icon={LogIn} className="w-full">
          Sign in
        </Button>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
        </div>
        <Button type="button" variant="secondary" onClick={google} className="w-full">
          <svg aria-hidden viewBox="0 0 48 48" className="size-4"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Continue with Google
        </Button>
      </form>
      {useEmulators && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts (local emulator)</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className="rounded-lg bg-slate-50 px-3 py-2 text-left text-xs ring-1 ring-slate-200 hover:bg-brand-50"
              >
                <span className="block font-semibold text-slate-800">{a.label}</span>
                <span className="block truncate text-slate-500">{a.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthCard>
  );
}
