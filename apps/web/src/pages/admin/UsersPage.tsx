import { createStaffUserSchema, fieldErrors, ROLES, type Role, type UserDoc } from '@civiclink/shared';
import { collection, orderBy, query } from 'firebase/firestore';
import { UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSession } from '../../auth/AuthProvider';
import { Button, Card, cx, ErrorState, Field, Input, LoadingState, Notice, PageHeader, Pill, Select } from '../../components/ui';
import { call, type ApiError } from '../../lib/api';
import { db } from '../../lib/firebase';
import { formatDateTime } from '../../lib/format';
import { useLiveQuery, type WithId } from '../../lib/hooks';
import { useDepartments } from '../official/useStaffReports';

const ROLE_LABEL: Record<Role, string> = { RESIDENT: 'Resident', OFFICIAL: 'Official', FIELD_WORKER: 'Field worker', ADMIN: 'Administrator' };

function CreateStaffForm({ onDone }: { onDone: (msg: string) => void }) {
  const departments = useDepartments();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OFFICIAL', departmentId: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = { ...form, departmentId: form.role === 'ADMIN' ? undefined : form.departmentId || undefined };
    const parsed = createStaffUserSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    setError(null);
    try {
      await call('createStaffUser', input);
      onDone(`Account created for ${form.name}`);
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors(apiErr.fields);
      setError(apiErr.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" noValidate>
      {error && <div className="sm:col-span-2 lg:col-span-3"><Notice tone="error">{error}</Notice></div>}
      <Field label="Full name" htmlFor="s-name" error={errors.name}><Input id="s-name" value={form.name} onChange={set('name')} invalid={!!errors.name} /></Field>
      <Field label="Work email" htmlFor="s-email" error={errors.email}><Input id="s-email" type="email" value={form.email} onChange={set('email')} invalid={!!errors.email} /></Field>
      <Field label="Temporary password" htmlFor="s-password" error={errors.password}><Input id="s-password" type="text" value={form.password} onChange={set('password')} invalid={!!errors.password} /></Field>
      <Field label="Role" htmlFor="s-role">
        <Select id="s-role" value={form.role} onChange={set('role')}>
          <option value="OFFICIAL">Official</option>
          <option value="FIELD_WORKER">Field worker</option>
          <option value="ADMIN">Administrator</option>
        </Select>
      </Field>
      {form.role !== 'ADMIN' && (
        <Field label="Department" htmlFor="s-dept" error={errors.departmentId}>
          <Select id="s-dept" value={form.departmentId} onChange={set('departmentId')} invalid={!!errors.departmentId}>
            <option value="">Choose…</option>
            {departments.data.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
      )}
      <div className="flex items-end"><Button type="submit" busy={busy} icon={UserPlus}>Create account</Button></div>
    </form>
  );
}

function UserRow({ user: u, self, deptName }: { user: WithId<UserDoc>; self: boolean; deptName: (id?: string | null) => string }) {
  const departments = useDepartments();
  const [role, setRole] = useState<Role>(u.role);
  const [dept, setDept] = useState(u.departmentId ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsDept = role === 'OFFICIAL' || role === 'FIELD_WORKER';
  const changed = role !== u.role || (needsDept && dept !== (u.departmentId ?? ''));

  const run = async (kind: string, fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <tr className={cx(!u.isActive && 'bg-slate-50 text-slate-500')} data-testid="user-row">
      <td className="px-3 py-2.5">
        <p className="font-medium text-slate-900">{u.name}{self && <span className="ml-1 text-xs text-slate-500">(you)</span>}</p>
        <p className="text-xs text-slate-500">{u.email}</p>
        {error && <p role="alert" className="text-xs font-medium text-red-700">{error}</p>}
      </td>
      <td className="px-3 py-2.5">
        <Select aria-label={`Role for ${u.name}`} value={role} disabled={self} onChange={(e) => setRole(e.target.value as Role)} className="min-w-36">
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </Select>
      </td>
      <td className="px-3 py-2.5">
        {needsDept ? (
          <Select aria-label={`Department for ${u.name}`} value={dept} disabled={self} onChange={(e) => setDept(e.target.value)} className="min-w-40">
            <option value="">Choose…</option>
            {departments.data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        ) : (
          <span className="text-sm">{u.role === 'RESIDENT' ? u.suburb : deptName(u.departmentId)}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs">{formatDateTime(u.lastLoginAt)}</td>
      <td className="px-3 py-2.5">{u.isActive ? <Pill tone="green">Active</Pill> : <Pill tone="red">Deactivated</Pill>}</td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex justify-end gap-1">
          {changed && (
            <Button busy={busy === 'role'} onClick={() => run('role', () => call('setUserRole', { uid: u.id, role, departmentId: needsDept ? dept : undefined }))}>Save</Button>
          )}
          {!self && (
            <Button variant={u.isActive ? 'ghost' : 'secondary'} className={u.isActive ? 'text-red-700' : ''} busy={busy === 'active'} onClick={() => run('active', () => call('setUserActive', { uid: u.id, active: !u.isActive }))}>
              {u.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

/** FR-20 / BR-15 / BR-16: staff accounts, roles and activation. */
export function UsersPage() {
  const { uid } = useSession();
  const users = useLiveQuery<UserDoc>(query(collection(db, 'users'), orderBy('name')), 'users-all');
  const departments = useDepartments();
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const deptName = (id?: string | null) => departments.data.find((d) => d.id === id)?.name ?? '—';
  const shown = users.data.filter(
    (u) => (!roleFilter || u.role === roleFilter) && (!search || `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div>
      <PageHeader title="Users" subtitle={`${users.data.length} accounts`} actions={<Button icon={UserPlus} onClick={() => setShowCreate((s) => !s)}>New staff account</Button>} />
      {message && <div className="mb-4"><Notice tone="success">{message}.</Notice></div>}
      {showCreate && (
        <Card className="mb-4">
          <CreateStaffForm onDone={(m) => { setMessage(m); setShowCreate(false); }} />
        </Card>
      )}
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input aria-label="Search users" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="max-w-48">
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        </div>
        {users.loading && <LoadingState />}
        {users.error && <ErrorState error={users.error} />}
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">User</th>
                <th className="px-3 py-2 font-semibold">Role</th>
                <th className="px-3 py-2 font-semibold">Department / suburb</th>
                <th className="px-3 py-2 font-semibold">Last sign-in</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((u) => <UserRow key={u.id} user={u} self={u.id === uid} deptName={deptName} />)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
