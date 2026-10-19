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
  const { session, signIn, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {notice && <Notice tone="warning">{notice}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" busy={busy} icon={LogIn} className="w-full">
          Sign in
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
