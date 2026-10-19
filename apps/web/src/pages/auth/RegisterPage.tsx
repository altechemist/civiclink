import { registerResidentSchema, fieldErrors, SUBURBS } from '@civiclink/shared';
import { UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { HOME, useAuth } from '../../auth/AuthProvider';
import { Button, Field, Input, Notice, Select } from '../../components/ui';
import { call } from '../../lib/api';
import { AuthCard } from './AuthCard';

/** FR-01: self-registration always creates a Resident (BR-16). */
export function RegisterPage() {
  const { session, signIn } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', suburb: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={HOME[session.claims.role]} replace />;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors(({ [k]: _, ...rest }) => rest);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = registerResidentSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    try {
      await call('registerResident', form);
      await signIn(form.email.trim(), form.password);
    } catch (err) {
      const e2 = err as { fields?: Record<string, string>; message: string };
      if (e2.fields && Object.keys(e2.fields).length) setErrors(e2.fields);
      else setFormError(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Create a resident account"
      subtitle="We use your suburb to send you alerts that affect your area."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-white underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Notice tone="error">{formError}</Notice>}
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters">
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} invalid={!!errors.password} />
        </Field>
        <Field label="Suburb" htmlFor="suburb" error={errors.suburb}>
          <Select id="suburb" value={form.suburb} onChange={set('suburb')} invalid={!!errors.suburb}>
            <option value="">Choose your suburb…</option>
            {SUBURBS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Mobile number (optional)" htmlFor="phone" error={errors.phone} hint="Used only by the municipality to contact you about your reports">
          <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} invalid={!!errors.phone} />
        </Field>
        <p className="text-xs text-slate-500">
          CivicLink stores your details only to deliver municipal services, in line with POPIA. Your name and contact details are never shown to other residents.
        </p>
        <Button type="submit" busy={busy} icon={UserPlus} className="w-full">
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
