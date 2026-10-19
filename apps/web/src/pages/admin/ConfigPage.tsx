import type { CategoryDoc, DepartmentDoc } from '@civiclink/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CategoryIcon, useCategories } from '../../components/domain';
import { Button, Card, ErrorState, Input, LoadingState, Notice, PageHeader, Select } from '../../components/ui';
import { call, type ApiError } from '../../lib/api';
import type { WithId } from '../../lib/hooks';
import { useDepartments } from '../official/useStaffReports';

const ICON_CHOICES = ['droplets', 'droplet', 'zap', 'construction', 'trash', 'shield-alert', 'hammer', 'lamp', 'circle-help'];

function DepartmentRow({ dept }: { dept?: WithId<DepartmentDoc> }) {
  const [name, setName] = useState(dept?.name ?? '');
  const [sla, setSla] = useState(String(dept?.slaHours ?? 48));
  const [active, setActive] = useState(dept?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await call('upsertDepartment', { id: dept?.id, name, slaHours: Number(sla), isActive: active });
      setSaved(true);
      if (!dept) setName('');
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid items-start gap-2 border-b border-slate-100 py-3 sm:grid-cols-[1fr_8rem_6rem_auto]">
      <div>
        <Input aria-label="Department name" value={name} onChange={(e) => setName(e.target.value)} placeholder="New department" invalid={!!error?.fields.name} />
        {error && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{Object.values(error.fields)[0] ?? error.message}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Input aria-label="SLA hours" type="number" min={1} max={720} value={sla} onChange={(e) => setSla(e.target.value)} invalid={!!error?.fields.slaHours} />
        <span className="text-slate-500">h</span>
      </label>
      <label className="flex items-center gap-2 pt-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" /> Active
      </label>
      <Button variant={dept ? 'secondary' : 'primary'} icon={dept ? undefined : Plus} busy={busy} onClick={save}>
        {dept ? (saved ? 'Saved' : 'Save') : 'Add'}
      </Button>
    </div>
  );
}

function CategoryRow({ cat, departments }: { cat?: WithId<CategoryDoc>; departments: WithId<DepartmentDoc>[] }) {
  const [name, setName] = useState(cat?.name ?? '');
  const [icon, setIcon] = useState(cat?.icon ?? 'circle-help');
  const [departmentId, setDepartmentId] = useState(cat?.departmentId ?? '');
  const [active, setActive] = useState(cat?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await call('upsertCategory', { id: cat?.id, name, icon, departmentId, isActive: active });
      setSaved(true);
      if (!cat) setName('');
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid items-start gap-2 border-b border-slate-100 py-3 sm:grid-cols-[auto_1fr_9rem_12rem_6rem_auto]">
      <CategoryIcon icon={icon} categoryId={cat?.id ?? ''} />
      <div>
        <Input aria-label="Category name" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" />
        {error && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{Object.values(error.fields)[0] ?? error.message}</p>}
      </div>
      <Select aria-label="Icon" value={icon} onChange={(e) => setIcon(e.target.value)}>
        {ICON_CHOICES.map((i) => <option key={i}>{i}</option>)}
      </Select>
      <Select aria-label="Routes to department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
        <option value="">Department…</option>
        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </Select>
      <label className="flex items-center gap-2 pt-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" /> Active
      </label>
      <Button variant={cat ? 'secondary' : 'primary'} icon={cat ? undefined : Plus} busy={busy} onClick={save}>
        {cat ? (saved ? 'Saved' : 'Save') : 'Add'}
      </Button>
    </div>
  );
}

/** FR-21 / BR-19: department SLAs and category routing. */
export function ConfigPage() {
  const departments = useDepartments();
  const categories = useCategories();
  return (
    <div className="space-y-4">
      <PageHeader title="Departments & categories" subtitle="SLA targets drive automatic escalation; categories decide where new reports are routed." />
      <Notice tone="info">Deactivating keeps history intact: inactive categories disappear from the report form, inactive departments from assignment.</Notice>
      <Card>
        <h2 className="font-semibold text-slate-900">Departments</h2>
        {departments.loading && <LoadingState />}
        {departments.error && <ErrorState error={departments.error} />}
        {departments.data.map((d) => <DepartmentRow key={d.id} dept={d} />)}
        <DepartmentRow key={`new-${departments.data.length}`} />
      </Card>
      <Card>
        <h2 className="font-semibold text-slate-900">Incident categories</h2>
        {categories.data.map((c) => <CategoryRow key={c.id} cat={c} departments={departments.data} />)}
        <CategoryRow key={`new-${categories.data.length}`} departments={departments.data} />
      </Card>
    </div>
  );
}
