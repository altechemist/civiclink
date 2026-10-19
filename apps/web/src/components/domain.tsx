import type { CategoryDoc, HistoryDoc, NotificationDoc, ReportStatus } from '@civiclink/shared';
import { collection, doc, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  Bell,
  CircleHelp,
  Construction,
  Droplet,
  Droplets,
  Hammer,
  Lamp,
  ShieldAlert,
  Trash2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/AuthProvider';
import { db } from '../lib/firebase';
import { formatDateTime, LIFECYCLE, STATUS_LABEL, timeAgo } from '../lib/format';
import { useDownloadUrls, useLiveQuery, type WithId } from '../lib/hooks';
import { cx } from './ui';

const ICONS: Record<string, LucideIcon> = {
  droplets: Droplets,
  droplet: Droplet,
  zap: Zap,
  construction: Construction,
  trash: Trash2,
  'shield-alert': ShieldAlert,
  hammer: Hammer,
  lamp: Lamp,
  'circle-help': CircleHelp,
};
export const CATEGORY_COLOURS: Record<string, string> = {
  'burst-pipe': '#0284c7',
  'water-leak': '#0ea5e9',
  electricity: '#7c3aed',
  'road-damage': '#dc2626',
  'illegal-dumping': '#16a34a',
  'public-safety': '#ea580c',
  vandalism: '#db2777',
  other: '#64748b',
};
export const categoryColour = (id: string) => CATEGORY_COLOURS[id] ?? '#475569';

export function CategoryIcon({ icon, categoryId, className }: { icon?: string; categoryId: string; className?: string }) {
  const Icon = ICONS[icon ?? ''] ?? CircleHelp;
  return (
    <span className={cx('inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-white', className)} style={{ background: categoryColour(categoryId) }}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

/** Category icon names keyed by id, for lists that only store the id. */
export function useCategories() {
  return useLiveQuery<CategoryDoc>(query(collection(db, 'categories'), orderBy('name')), 'categories');
}

/** Resident-facing 4-step lifecycle progress (FR-06). */
export function LifecycleProgress({ status }: { status: ReportStatus }) {
  const effective: ReportStatus = status === 'ESCALATED' ? 'IN_PROGRESS' : status === 'CLOSED' ? 'RESOLVED' : status;
  const idx = LIFECYCLE.indexOf(effective);
  if (idx < 0) return null;
  return (
    <ol className="flex items-center gap-1" aria-label={`Progress: ${STATUS_LABEL[status]}`}>
      {LIFECYCLE.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col gap-1">
          <span className={cx('h-1.5 rounded-full', i <= idx ? (effective === 'RESOLVED' ? 'bg-emerald-500' : 'bg-brand-600') : 'bg-slate-200')} />
          <span className={cx('text-[11px] leading-tight', i === idx ? 'font-semibold text-slate-900' : 'text-slate-500')}>{STATUS_LABEL[s]}</span>
        </li>
      ))}
    </ol>
  );
}

/** Chronological status audit trail (BR-05). */
export function Timeline({ items }: { items: WithId<HistoryDoc>[] }) {
  const sorted = [...items].sort((a, b) => a.at.toMillis() - b.at.toMillis());
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {sorted.map((h) => (
        <li key={h.id} className="relative">
          <span className={cx('absolute -left-[26px] top-1 size-3 rounded-full ring-4 ring-white', h.from === h.to ? 'bg-slate-300' : 'bg-brand-600')} />
          <p className="text-sm font-semibold text-slate-900">{h.from === h.to ? h.note : STATUS_LABEL[h.to]}</p>
          {h.from !== h.to && <p className="text-sm text-slate-700">{h.note}</p>}
          <p className="text-xs text-slate-500">
            {formatDateTime(h.at)} · {h.actorName} ({h.actorRole.replace('_', ' ').toLowerCase()})
          </p>
        </li>
      ))}
    </ol>
  );
}

export function PhotoGrid({ paths, label }: { paths: string[]; label: string }) {
  const urls = useDownloadUrls(paths);
  if (!paths.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2" aria-label={label}>
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-slate-200">
          <img src={u} alt={`${label} ${i + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

/** Live notification bell (FR-15). */
export function NotificationBell({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { uid } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const { data } = useLiveQuery<NotificationDoc>(
    query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(30)),
    `notifications-${uid}`,
  );
  const unread = data.filter((n) => !n.readAt).length;

  useEffect(() => {
    const close = (e: MouseEvent) => panel.current && !panel.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const openItem = async (n: WithId<NotificationDoc>) => {
    setOpen(false);
    if (!n.readAt) await updateDoc(doc(db, 'users', uid, 'notifications', n.id), { readAt: serverTimestamp() }).catch(() => {});
    navigate(n.link);
  };
  const markAll = () =>
    Promise.all(data.filter((n) => !n.readAt).map((n) => updateDoc(doc(db, 'users', uid, 'notifications', n.id), { readAt: serverTimestamp() })));

  return (
    <div className="relative" ref={panel}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications, ${unread} unread`}
        data-testid="notification-bell"
        className={cx('relative rounded-full p-2', tone === 'dark' ? 'text-white hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100')}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span data-testid="notification-count" className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-[1100] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-brand-700 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {data.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">You're all caught up.</li>}
            {data.map((n) => (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={cx('block w-full px-4 py-3 text-left hover:bg-slate-50', !n.readAt && 'bg-brand-50/60')}>
                  <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                  <p className="line-clamp-2 text-sm text-slate-600">{n.body}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{timeAgo(n.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ReportLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      {children}
    </Link>
  );
}
