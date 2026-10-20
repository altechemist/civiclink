import { fieldErrors, SUBURBS, upgradeGuestSchema } from '@civiclink/shared';
import { FirebaseError } from 'firebase/app';
import { EmailAuthProvider, GoogleAuthProvider, linkWithCredential, linkWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { LogIn, LogOut, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useSession } from '../../auth/AuthProvider';
import { Button, Card, Field, Input, Notice, PageHeader, Select } from '../../components/ui';
import { call, type ApiError } from '../../lib/api';
import { auth } from '../../lib/firebase';

const authMessage = (err: unknown) => {
  const code = err instanceof FirebaseError ? err.code : '';
  if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use')
    return 'That sign-in already belongs to an account. Use "I already have an account" below.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Email or password is incorrect.';
  if (code === 'auth/weak-password') return 'Use a password of at least 8 characters.';
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled.';
  return (err as Error).message;
};

/**
 * FR-39: a guest keeps their reports by creating an account in this same session (email/password or
 * Google is linked to the guest sign-in, so nothing moves), or moves them into an account they already
 * have with a one-time transfer code. Signing out as a guest is explained first.
 */
export function GuestAccountPage() {
  const { claims } = useSession();
  const { refreshClaims, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', suburb: '', phone: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | 'google' | 'signin' | null>(null);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);

  if (!claims.guest) return <Navigate to="/resident" replace />;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors(({ [k]: _, ...rest }) => rest);
  };

  const profile = () => ({ name: form.name, suburb: form.suburb, phone: form.phone });
  const finish = async () => {
    await call('upgradeGuest', profile());
    await refreshClaims();
    navigate('/resident', { replace: true });
  };

  const create = async (how: 'email' | 'google', e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    const parsed = upgradeGuestSchema.safeParse(profile());
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    if (how === 'email') {
      if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email';
      if (form.password.length < 8) errs.password = 'At least 8 characters';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(how);
    try {
      const user = auth.currentUser!;
      if (how === 'email') await linkWithCredential(user, EmailAuthProvider.credential(form.email.trim(), form.password));
      else await linkWithPopup(user, new GoogleAuthProvider());
      await finish();
    } catch (err) {
      setError(err instanceof FirebaseError ? authMessage(err) : (err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const signInExisting = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setBusy('signin');
    try {
      const { code } = await call('startGuestTransfer', {});
      await signInWithEmailAndPassword(auth, login.email.trim(), login.password);
      const { moved } = await call('claimGuestReports', { code });
      await refreshClaims();
      navigate('/resident', { replace: true, state: { notice: `${moved} report${moved === 1 ? '' : 's'} moved to your account.` } });
    } catch (err) {
      setLoginError(err instanceof FirebaseError ? authMessage(err) : (err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Keep your reports" subtitle="You're using CivicLink as a guest." />
      {params.get('leaving') && (
        <div data-testid="guest-leaving">
          <Notice tone="warning">
            If you sign out now, this browser forgets your guest session and you can no longer follow your reports. Create an account (or sign in) first
            to keep them.
          </Notice>
          <div className="mt-2">
            <Button variant="ghost" icon={LogOut} className="text-red-700" onClick={() => signOut()}>
              Sign out anyway
            </Button>
          </div>
        </div>
      )}

      <Card>
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <UserPlus className="size-4" aria-hidden /> Create an account
        </h2>
        <p className="mb-3 text-sm text-slate-600">Your reports stay exactly as they are, and you'll get alerts for your suburb.</p>
        <form onSubmit={(e) => create('email', e)} className="space-y-3" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="Full name" htmlFor="g-name" error={errors.name}>
            <Input id="g-name" value={form.name} onChange={set('name')} invalid={!!errors.name} autoComplete="name" />
          </Field>
          <Field label="Suburb" htmlFor="g-suburb" error={errors.suburb} hint="Alerts are sent to residents of this suburb">
            <Select id="g-suburb" value={form.suburb} onChange={set('suburb')} invalid={!!errors.suburb}>
              <option value="">Choose your suburb</option>
              {SUBURBS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Mobile number (optional)" htmlFor="g-phone" error={errors.phone}>
            <Input id="g-phone" type="tel" value={form.phone} onChange={set('phone')} invalid={!!errors.phone} autoComplete="tel" />
          </Field>
          <Field label="Email" htmlFor="g-email" error={errors.email}>
            <Input id="g-email" type="email" value={form.email} onChange={set('email')} invalid={!!errors.email} autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="g-password" error={errors.password} hint="At least 8 characters">
            <Input id="g-password" type="password" value={form.password} onChange={set('password')} invalid={!!errors.password} autoComplete="new-password" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" icon={UserPlus} busy={busy === 'email'}>
              Create account
            </Button>
            <Button type="button" variant="secondary" busy={busy === 'google'} onClick={() => create('google')}>
              Use Google instead
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <LogIn className="size-4" aria-hidden /> I already have an account
        </h2>
        <p className="mb-3 text-sm text-slate-600">Sign in and your guest reports move to your account.</p>
        <form onSubmit={signInExisting} className="space-y-3" noValidate>
          {loginError && <Notice tone="error">{loginError}</Notice>}
          <Field label="Email" htmlFor="l-email">
            <Input id="l-email" type="email" value={login.email} onChange={(e) => setLogin((l) => ({ ...l, email: e.target.value }))} autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="l-password">
            <Input id="l-password" type="password" value={login.password} onChange={(e) => setLogin((l) => ({ ...l, password: e.target.value }))} autoComplete="current-password" />
          </Field>
          <Button type="submit" variant="secondary" icon={LogIn} busy={busy === 'signin'}>
            Sign in and move my reports
          </Button>
        </form>
      </Card>
    </div>
  );
}
