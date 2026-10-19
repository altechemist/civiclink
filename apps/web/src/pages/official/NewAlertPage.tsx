import { ALERT_TYPES, ALL_SUBURBS, broadcastAlertSchema, fieldErrors, LIMITS, SUBURBS, validateAlertExpiry, type AlertType } from '@civiclink/shared';
import { Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackLink, Button, Card, cx, Field, Input, Notice, PageHeader, Select, Textarea } from '../../components/ui';
import { call } from '../../lib/api';
import { AlertCard } from '../resident/AlertsFeedPage';

const toLocalInput = (ms: number) => new Date(ms - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/** FR-16: compose and broadcast a suburb-targeted alert (BR-13) with a live resident preview. */
export function NewAlertPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<AlertType>('EMERGENCY');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targets, setTargets] = useState<string[]>([]);
  const [expires, setExpires] = useState(toLocalInput(Date.now() + 24 * 3600_000));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clear = (field: string) => setErrors(({ [field]: _, ...rest }) => rest);
  const toggle = (s: string) => {
    clear('targetSuburbs');
    setTargets((t) => (s === ALL_SUBURBS ? (t.includes(ALL_SUBURBS) ? [] : [ALL_SUBURBS]) : t.includes(s) ? t.filter((x) => x !== s) : [...t.filter((x) => x !== ALL_SUBURBS), s]));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = { type, title, message, targetSuburbs: targets, expiresAt: new Date(expires).getTime() };
    const parsed = broadcastAlertSchema.safeParse(input);
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    const expiryErr = validateAlertExpiry(input.expiresAt, Date.now());
    if (expiryErr) errs.expiresAt = expiryErr;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await call('broadcastAlert', input);
      navigate('/official/alerts', { state: { sent: `Alert sent to ${res.recipientCount} resident${res.recipientCount === 1 ? '' : 's'}` } });
    } catch (err) {
      const apiErr = err as { fields: Record<string, string>; message: string };
      setErrors(apiErr.fields ?? {});
      setFormError(apiErr.message);
    } finally {
      setBusy(false);
    }
  };

  const preview = {
    id: 'preview',
    type,
    title: title || 'Alert title',
    message: message || 'Your message to residents appears here.',
    targetSuburbs: targets.length ? targets : ['—'],
    createdBy: '',
    createdByName: '',
    isActive: true,
    recipientCount: 0,
    readCount: 0,
    createdAt: { toMillis: () => Date.now() },
    expiresAt: { toMillis: () => new Date(expires).getTime() || Date.now() },
    read: false,
  };

  return (
    <div>
      <BackLink to="/official/alerts">Alerts</BackLink>
      <PageHeader title="Broadcast an alert" subtitle="Residents registered in the chosen suburbs see it in their alerts feed immediately." />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <form onSubmit={submit} className="space-y-4" noValidate>
            {formError && <Notice tone="error">{formError}</Notice>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" htmlFor="type">
                <Select id="type" value={type} onChange={(e) => setType(e.target.value as AlertType)}>
                  {ALERT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Expires" htmlFor="expires" error={errors.expiresAt} hint={`Within ${LIMITS.alertMaxDays} days`}>
                <Input id="expires" type="datetime-local" value={expires} onChange={(e) => { setExpires(e.target.value); clear('expiresAt'); }} invalid={!!errors.expiresAt} />
              </Field>
            </div>
            <Field label="Title" htmlFor="title" error={errors.title} hint={`${title.length}/${LIMITS.alertTitleMax}`}>
              <Input id="title" value={title} onChange={(e) => { setTitle(e.target.value); clear('title'); }} invalid={!!errors.title} placeholder="e.g. Strike: road closures in the CBD" />
            </Field>
            <Field label="Message" htmlFor="message" error={errors.message} hint={`${message.length}/${LIMITS.alertMessageMax}`}>
              <Textarea id="message" rows={4} value={message} onChange={(e) => { setMessage(e.target.value); clear('message'); }} invalid={!!errors.message} placeholder="What is happening, where, and what residents should do." />
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-slate-800">Target areas</legend>
              <div className="flex flex-wrap gap-2">
                {[ALL_SUBURBS, ...SUBURBS].map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={targets.includes(s)}
                    onClick={() => toggle(s)}
                    className={cx('rounded-full px-3 py-1 text-sm ring-1', targets.includes(s) ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50')}
                  >
                    {s === ALL_SUBURBS ? 'All of Sol Plaatje' : s}
                  </button>
                ))}
              </div>
              {errors.targetSuburbs && <p role="alert" className="mt-1 text-sm font-medium text-red-700">{errors.targetSuburbs}</p>}
            </fieldset>
            <Button type="submit" busy={busy} icon={Send}>
              Broadcast now
            </Button>
          </form>
        </Card>
        <div className="lg:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Resident preview</p>
          <AlertCard alert={preview as never} />
        </div>
      </div>
    </div>
  );
}
