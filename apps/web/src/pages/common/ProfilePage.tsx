import { fieldErrors, SUBURBS, updateProfileSchema, type UserDoc } from '@civiclink/shared';
import { Save, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth, useSession } from '../../auth/AuthProvider';
import { Button, Card, Field, Input, LoadingState, Notice, PageHeader, Select } from '../../components/ui';
import { call, type ApiError } from '../../lib/api';

const ROLE_LABEL = { RESIDENT: 'Resident', OFFICIAL: 'Municipal official', FIELD_WORKER: 'Field worker', ADMIN: 'Administrator' } as const;

/** FR-31 (own details) and FR-32 (POPIA account deletion for residents). */
export function ProfilePage() {
  const { profile } = useSession();
  // The editor copies the profile into form state, so wait until it has loaded.
  return profile ? <ProfileEditor profile={profile} /> : <LoadingState label="Loading your profile" />;
}

function ProfileEditor({ profile }: { profile: UserDoc }) {
  const { claims, user } = useSession();
  const { refreshClaims, signOut } = useAuth();
  const isResident = claims.role === 'RESIDENT';
  const [form, setForm] = useState({ name: profile.name, phone: profile.phone ?? '', suburb: profile.suburb ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors(({ [k]: _, ...rest }) => rest);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const input = { name: form.name, phone: form.phone, ...(isResident ? { suburb: form.suburb } : {}) };
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    setNotice(null);
    try {
      await call('updateProfile', input);
      await refreshClaims(); // suburb drives alert targeting (BR-14)
      setNotice({ tone: 'success', text: 'Your details were saved.' });
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors(apiErr.fields);
      setNotice({ tone: 'error', text: apiErr.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await call('deleteMyAccount', { confirm });
      await signOut(`Your account and personal information were deleted. ${res.anonymisedReports} report(s) were kept anonymously for municipal records.`);
    } catch (err) {
      setDeleteError((err as ApiError).message);
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="My profile" subtitle={`${ROLE_LABEL[claims.role]} · ${user.email}`} />
      <Card>
        <form onSubmit={save} className="space-y-4" noValidate>
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          <Field label="Full name" htmlFor="p-name" error={errors.name}>
            <Input id="p-name" value={form.name} onChange={set('name')} invalid={!!errors.name} autoComplete="name" />
          </Field>
          <Field label="Mobile number (optional)" htmlFor="p-phone" error={errors.phone}>
            <Input id="p-phone" type="tel" value={form.phone} onChange={set('phone')} invalid={!!errors.phone} autoComplete="tel" />
          </Field>
          {isResident && (
            <Field label="Suburb" htmlFor="p-suburb" error={errors.suburb} hint="Alerts are sent to residents of this suburb">
              <Select id="p-suburb" value={form.suburb} onChange={set('suburb')} invalid={!!errors.suburb}>
                {SUBURBS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          )}
          <Button type="submit" busy={busy} icon={Save}>
            Save changes
          </Button>
        </form>
      </Card>

      {isResident && (
        <Card className="ring-red-200">
          <h2 className="font-semibold text-red-800">Delete my account</h2>
          <p className="mt-1 text-sm text-slate-700">
            Under POPIA you can ask us to delete your personal information. This permanently removes your name, email, phone number, photos,
            notifications and sign-in. Your reports stay in the municipality's records <strong>without your name</strong>, so that work on them can
            continue.
          </p>
          {deleteError && <div className="mt-3"><Notice tone="error">{deleteError}</Notice></div>}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label='Type "DELETE" to confirm' htmlFor="confirm">
              <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            </Field>
            <Button variant="danger" icon={Trash2} busy={deleting} disabled={confirm !== 'DELETE'} onClick={remove}>
              Delete permanently
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
