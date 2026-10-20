import { OutboxSync } from '../components/outbox';
import {
  BarChart3,
  ClipboardList,
  Cog,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map as MapIcon,
  Megaphone,
  PlusCircle,
  ScrollText,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, useSession } from '../auth/AuthProvider';
import { NotificationBell } from '../components/domain';
import { cx } from '../components/ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  emphasis?: boolean;
}

function Brand({ light }: { light?: boolean }) {
  return (
    <span className={cx('flex items-center gap-2 font-bold tracking-tight', light ? 'text-white' : 'text-brand-800')}>
      <img src="/favicon.svg" alt="" className="size-7" />
      CivicLink
    </span>
  );
}

/** Mobile-first shell for residents and field workers (NFR-07). */
function MobileShell({ nav, accent }: { nav: NavItem[]; accent: 'brand' | 'field' }) {
  const { signOut } = useAuth();
  const { profile } = useSession();
  const bar = accent === 'brand' ? 'bg-brand-800' : 'bg-field-700';
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className={cx('sticky top-0 z-[1000] text-white shadow', bar)} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2.5">
          <Brand light />
          <div className="flex items-center gap-1">
            <span className="mr-1 hidden text-sm text-white/80 sm:inline">{profile?.name}</span>
            <NotificationBell />
            <NavLink to="/profile" aria-label="My profile" className="rounded-full p-2 hover:bg-white/10">
              <UserRound className="size-5" aria-hidden />
            </NavLink>
            <button onClick={() => signOut()} aria-label="Sign out" className="rounded-full p-2 hover:bg-white/10">
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5">
        <Outlet />
      </main>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-[1000] border-t border-slate-200 bg-white"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex max-w-3xl justify-around">
          {nav.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-slate-500')
                }
              >
                <span className={cx(n.emphasis && 'rounded-full bg-brand-700 p-1.5 text-white')}>
                  <n.icon className="size-5" aria-hidden />
                </span>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function ResidentLayout() {
  return (
    <>
    <OutboxSync />
    <MobileShell
      accent="brand"
      nav={[
        { to: '/resident', label: 'Home', icon: Home, end: true },
        { to: '/map', label: 'Map', icon: MapIcon },
        { to: '/resident/report/new', label: 'Report', icon: PlusCircle, emphasis: true },
        { to: '/resident/reports', label: 'My reports', icon: ClipboardList },
        { to: '/resident/alerts', label: 'Alerts', icon: Megaphone },
      ]}
    />
    </>
  );
}

export function WorkerLayout() {
  return <MobileShell accent="field" nav={[{ to: '/worker', label: 'My tasks', icon: ListChecks, end: true }]} />;
}

/** Desktop shell for officials and administrators. */
export function StaffLayout() {
  const { signOut } = useAuth();
  const { claims, profile } = useSession();
  const isAdmin = claims.role === 'ADMIN';
  const sections: { title: string; items: NavItem[] }[] = [
    {
      title: 'Operations',
      items: [
        { to: '/official', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/official/reports', label: 'Report queue', icon: ClipboardList },
        { to: '/map', label: 'Incident map', icon: MapIcon },
        { to: '/official/alerts', label: 'Alerts', icon: Megaphone },
        { to: '/official/analytics', label: 'Analytics', icon: BarChart3 },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: 'Administration',
            items: [
              { to: '/admin/users', label: 'Users', icon: Users },
              { to: '/admin/config', label: 'Departments & categories', icon: Cog },
              { to: '/admin/logs', label: 'System log', icon: ScrollText },
            ],
          },
        ]
      : []),
  ];
  return (
    <div className="min-h-dvh bg-slate-50 lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:py-5">
          <Brand />
          <div className="flex items-center lg:hidden">
            <NotificationBell tone="light" />
            <button onClick={() => signOut()} aria-label="Sign out" className="rounded-full p-2 text-slate-600 hover:bg-slate-100">
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:flex-1 lg:space-y-5 lg:overflow-visible">
          {sections.map((s) => (
            <div key={s.title} className="flex gap-1 lg:block lg:space-y-1">
              <p className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:block">{s.title}</p>
              {s.items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium',
                      isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )
                  }
                >
                  <n.icon className="size-4" aria-hidden />
                  {n.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="hidden items-center justify-between border-t border-slate-200 px-4 py-3 lg:flex">
          <NavLink to="/profile" className="min-w-0 rounded-lg hover:bg-slate-50" aria-label="My profile">
            <p className="truncate text-sm font-semibold text-slate-900">{profile?.name}</p>
            <p className="truncate text-xs text-slate-500">
              {isAdmin ? 'Administrator' : 'Official'}
              {claims.dept ? ` · ${claims.dept}` : ''}
            </p>
          </NavLink>
          <div className="flex items-center">
            <NotificationBell tone="light" />
            <button onClick={() => signOut()} aria-label="Sign out" className="rounded-full p-2 text-slate-600 hover:bg-slate-100">
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

/** The map is shared by residents (mobile shell) and staff (sidebar shell). */
export function RoleShell() {
  const { claims } = useSession();
  if (claims.role === 'RESIDENT') return <ResidentLayout />;
  if (claims.role === 'FIELD_WORKER') return <WorkerLayout />;
  return <StaffLayout />;
}
