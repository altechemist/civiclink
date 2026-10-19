import { completeProfileSchema, fieldErrors, SUBURBS } from '@civiclink/shared';
import { CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { HOME, useAuth } from '../../auth/AuthProvider';
import { Button, Field, Input, LoadingState, Notice, Select } from '../../components/ui';
import { call, type ApiError } from '../../lib/api';
import { AuthCard } from './AuthCard';

/** FR-29: first sign-in with Google. Collects the suburb needed for alerts; the account is always a Resident (BR-16). */
export function WelcomePage() {
  const { session, pendingProfile, loading, refreshClaims, signOut } = useAuth();
  const [form, setForm] = useState({ name: pendingProfile?.displayName ?? '', suburb: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingState full />;
  if (session) return <Navigate to={HOME[session.claims.role]} replace />;
  if (!pendingProfile) return <Navigate to="/login" replace />;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors(({ [k]: _, ...rest }) => rest);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = completeProfileSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    setFormError(null);
    try {
      await call('completeProfile', form);
      await refreshClaims();
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors(apiErr.fields);
      setFormError(apiErr.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Welcome to CivicLink"
      subtitle={`Signed in as ${pendingProfile.email}. One more step: tell us where you live so we can send you alerts for your area.`}
      footer={
        <button onClick={() => signOut()} className="font-semibold text-white underline">
          Use a different account
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Notice tone="error">{formError}</Notice>}
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input id="name" value={form.name} onChange={set('name')} invalid={!!errors.name} autoComplete="name" />
        </Field>
        <Field label="Suburb" htmlFor="suburb" error={errors.suburb}>
          <Select id="suburb" value={form.suburb} onChange={set('suburb')} invalid={!!errors.suburb}>
            <option value="">Choose your suburb…</option>
            {SUBURBS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Mobile number (optional)" htmlFor="phone" error={errors.phone}>
          <Input id="phone" type="tel" value={form.phone} onChange={set('phone')} invalid={!!errors.phone} autoComplete="tel" />
        </Field>
        <Button type="submit" busy={busy} icon={CheckCircle2} className="w-full">
          Finish setting up
        </Button>
      </form>
    </AuthCard>
  );
}
