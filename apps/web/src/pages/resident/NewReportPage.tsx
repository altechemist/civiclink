import {
  fieldErrors,
  LIMITS,
  SEVERITIES,
  submitReportSchema,
  SUBURBS,
  SUBURB_CENTRES,
  nearestSuburb,
  type Suburb,
  type CallableResults,
  type LatLng,
  type Severity,
} from '@civiclink/shared';
import { Camera, CheckCircle2, Copy, Send, X } from 'lucide-react';
import { lazy, Suspense, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../auth/AuthProvider';
import { CategoryIcon, useCategories } from '../../components/domain';
import { useOnlineStatus } from '../../components/pwa';
import { Button, cx, ErrorState, Field, Input, LoadingState, Notice, PageHeader, Select, Textarea } from '../../components/ui';
import { call } from '../../lib/api';
import { checkPhoto, toPhotoInputs } from '../../lib/upload';

const LocationPicker = lazy(() => import('../../components/maps').then((m) => ({ default: m.LocationPicker })));

type Step = 1 | 2 | 3;
const SEVERITY_HELP: Record<Severity, string> = {
  HIGH: 'Danger to people or property, or many households affected',
  MEDIUM: 'Disrupts daily life but not dangerous',
  LOW: 'Minor issue, can wait',
};

/** FR-03/04/05: report an incident in three steps (NFR-07). */
export function NewReportPage() {
  const { claims } = useSession();
  const online = useOnlineStatus();
  const categories = useCategories();
  const [step, setStep] = useState<Step>(1);
  const [categoryId, setCategoryId] = useState('');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [suburb, setSuburb] = useState(claims.suburb ?? '');
  // The suburb follows the pin until the resident picks one themselves.
  const [suburbTouched, setSuburbTouched] = useState(false);
  const pinSuburb = location ? nearestSuburb(location) : null;
  const [landmark, setLandmark] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CallableResults['submitReport'] | null>(null);

  const clear = (field: string) => setErrors(({ [field]: _, ...rest }) => rest);
  const active = categories.data.filter((c) => c.isActive);
  const category = active.find((c) => c.id === categoryId);
  const draft = () => ({ categoryId, description, location, suburb, landmark: landmark || undefined, severity, photos: [] });

  const validateDetails = () => {
    const parsed = submitReportSchema.safeParse(draft());
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    if (!location) errs.location = 'Set the incident location on the map';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files)) {
      const problem = checkPhoto(f);
      if (problem) return setErrors((e) => ({ ...e, photos: `${f.name}: ${problem}` }));
      next.push(f);
    }
    if (next.length > LIMITS.photosMax) return setErrors((e) => ({ ...e, photos: `At most ${LIMITS.photosMax} photos` }));
    setErrors(({ photos: _, ...rest }) => rest);
    setPhotos(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateDetails()) return setStep(2);
    setBusy(true);
    setFormError(null);
    try {
      setResult(await call('submitReport', { ...draft(), photos: await toPhotoInputs(photos) }));
    } catch (err) {
      const apiErr = err as { fields?: Record<string, string>; message: string };
      if (apiErr.fields && Object.keys(apiErr.fields).length) {
        setErrors(apiErr.fields);
        setStep(2);
      }
      setFormError(apiErr.message);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-5 text-center" data-testid="report-result">
        {result.duplicateOf ? (
          <>
            <Copy className="mx-auto size-14 text-violet-600" aria-hidden />
            <h1 className="text-xl font-bold text-slate-900">This issue has already been reported</h1>
            <p className="text-slate-700">
              A neighbour reported the same problem nearby as <strong data-testid="parent-ref">{result.duplicateOf.ref}</strong>. We've added you to it, so
              you'll be notified as it progresses, and the municipality can see that more households are affected.
            </p>
            <Link to={`/resident/reports/${result.duplicateOf.reportId}`} className="inline-block font-semibold text-brand-700 hover:underline">
              Follow {result.duplicateOf.ref}
            </Link>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto size-14 text-emerald-600" aria-hidden />
            <h1 className="text-xl font-bold text-slate-900">Report submitted</h1>
            <p className="text-slate-700">
              Your reference number is <strong data-testid="report-ref">{result.ref}</strong>. You'll be notified every time its status changes.
            </p>
            <Link to={`/resident/reports/${result.reportId}`} className="inline-block font-semibold text-brand-700 hover:underline">
              Track this report
            </Link>
          </>
        )}
        <div>
          <Link to="/resident" className="text-sm text-slate-600 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader title="Report an issue" subtitle={`Step ${step} of 3 · ${['Choose a category', 'Where and what', 'Check and send'][step - 1]}`} />
      <div className="mb-5 flex gap-1" aria-hidden>
        {[1, 2, 3].map((s) => (
          <span key={s} className={cx('h-1.5 flex-1 rounded-full', s <= step ? 'bg-brand-600' : 'bg-slate-200')} />
        ))}
      </div>
      {formError && (
        <div className="mb-4">
          <Notice tone="error">{formError}</Notice>
        </div>
      )}

      {step === 1 && (
        <>
          {categories.loading && <LoadingState />}
          {categories.error && <ErrorState error={categories.error} />}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Category">
            {active.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={categoryId === c.id}
                onClick={() => {
                  setCategoryId(c.id);
                  setStep(2);
                }}
                className={cx(
                  'flex flex-col items-center gap-2 rounded-xl bg-white p-4 text-center text-sm font-medium shadow-sm ring-1 transition',
                  categoryId === c.id ? 'ring-2 ring-brand-600' : 'ring-slate-200 hover:ring-brand-300',
                )}
              >
                <CategoryIcon icon={c.icon} categoryId={c.id} className="size-11" />
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
            {category && <CategoryIcon icon={category.icon} categoryId={category.id} />}
            <p className="flex-1 font-semibold">{category?.name}</p>
            <button type="button" onClick={() => setStep(1)} className="text-sm font-medium text-brand-700">
              Change
            </button>
          </div>
          <Field label="Location" htmlFor="location" error={errors.location}>
            <div id="location">
              <Suspense fallback={<LoadingState label="Loading map" />}>
                <LocationPicker
                  value={location}
                  focus={SUBURB_CENTRES[suburb as Suburb] ?? null}
                  onChange={(l) => {
                    setLocation(l);
                    clear('location');
                    const near = nearestSuburb(l);
                    if (near && !suburbTouched) {
                      setSuburb(near);
                      clear('suburb');
                    }
                  }}
                  invalid={!!errors.location}
                />
              </Suspense>
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Suburb" htmlFor="suburb" error={errors.suburb}>
              <Select id="suburb" value={suburb} onChange={(e) => { setSuburb(e.target.value); setSuburbTouched(true); clear('suburb'); }} invalid={!!errors.suburb}>
                <option value="">Choose…</option>
                {SUBURBS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              {pinSuburb && suburb && pinSuburb !== suburb && (
                <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setSuburb(pinSuburb)}>
                  The pin is in {pinSuburb}. Use that?
                </button>
              )}
            </Field>
            <Field label="Nearby landmark (optional)" htmlFor="landmark" error={errors.landmark}>
              <Input id="landmark" value={landmark} maxLength={LIMITS.landmarkMax} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. opposite the clinic" />
            </Field>
          </div>
          <Field
            label="What is happening?"
            htmlFor="description"
            error={errors.description}
            hint={`${description.trim().length}/${LIMITS.descriptionMax} characters (at least ${LIMITS.descriptionMin})`}
          >
            <Textarea id="description" rows={4} value={description} maxLength={LIMITS.descriptionMax} onChange={(e) => { setDescription(e.target.value); clear('description'); }} invalid={!!errors.description} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-800">How serious is it?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {SEVERITIES.map((s) => (
                <label key={s} className={cx('cursor-pointer rounded-xl bg-white p-3 text-sm ring-1', severity === s ? 'ring-2 ring-brand-600' : 'ring-slate-200')}>
                  <input type="radio" name="severity" value={s} checked={severity === s} onChange={() => { setSeverity(s); clear('severity'); }} className="sr-only" />
                  <span className="block font-semibold">{s.charAt(0) + s.slice(1).toLowerCase()}</span>
                  <span className="text-xs text-slate-600">{SEVERITY_HELP[s]}</span>
                </label>
              ))}
            </div>
            {errors.severity && <p role="alert" className="mt-1 text-sm font-medium text-red-700">Choose how serious it is</p>}
          </fieldset>
          <Field label={`Photos (optional, up to ${LIMITS.photosMax})`} htmlFor="photos" error={errors.photos} hint="JPEG, PNG or WebP; large photos are compressed automatically">
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(p)} alt={`Photo ${i + 1}`} className="size-20 rounded-lg object-cover ring-1 ring-slate-200" />
                  <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-1 text-white">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {photos.length < LIMITS.photosMax && (
                <label htmlFor="photos" className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-400">
                  <Camera className="size-5" aria-hidden />
                  Add
                </label>
              )}
              <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
            </div>
          </Field>
          <div className="flex justify-between gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" onClick={() => validateDetails() && setStep(3)}>
              Review
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <dl className="divide-y divide-slate-100 rounded-xl bg-white text-sm ring-1 ring-slate-200">
            {[
              ['Category', category?.name],
              ['Location', `${suburb}${landmark ? `, ${landmark}` : ''}`],
              ['Coordinates', location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : '—'],
              ['Severity', severity],
              ['Description', description],
              ['Photos', photos.length ? `${photos.length} attached` : 'None'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-3 px-4 py-3">
                <dt className="font-medium text-slate-500">{k}</dt>
                <dd className="col-span-2 break-words text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-500">Your name and photos are visible only to municipal staff. Other residents see the category, status and approximate location.</p>
          <div className="flex justify-between gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>
              Edit
            </Button>
            <Button type="submit" busy={busy} icon={Send} disabled={!online}>
              {online ? 'Submit report' : 'Waiting for a connection'}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
