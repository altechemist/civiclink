import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, HOME, useAuth } from './auth/AuthProvider';
import { RequireRole } from './auth/RequireRole';
import { OfflineBanner } from './components/pwa';
import { LoadingState } from './components/ui';
import { ResidentLayout, RoleShell, StaffLayout, WorkerLayout } from './layouts/Layouts';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { WelcomePage } from './pages/auth/WelcomePage';
import { ProfilePage } from './pages/common/ProfilePage';
import { NotFoundPage } from './pages/common/NotFoundPage';
import { ResidentHome } from './pages/resident/ResidentHome';
import { NewReportPage } from './pages/resident/NewReportPage';
import { MyReportsPage } from './pages/resident/MyReportsPage';
import { ResidentReportPage } from './pages/resident/ResidentReportPage';
import { AlertsFeedPage } from './pages/resident/AlertsFeedPage';

// Staff and field-worker screens load on demand, keeping the resident bundle small (NFR-06).
const OfficialDashboard = lazy(() => import('./pages/official/OfficialDashboard').then((m) => ({ default: m.OfficialDashboard })));
const ReportQueuePage = lazy(() => import('./pages/official/ReportQueuePage').then((m) => ({ default: m.ReportQueuePage })));
const OfficialReportPage = lazy(() => import('./pages/official/OfficialReportPage').then((m) => ({ default: m.OfficialReportPage })));
const AlertsAdminPage = lazy(() => import('./pages/official/AlertsAdminPage').then((m) => ({ default: m.AlertsAdminPage })));
const NewAlertPage = lazy(() => import('./pages/official/NewAlertPage').then((m) => ({ default: m.NewAlertPage })));
const WorkerHome = lazy(() => import('./pages/worker/WorkerHome').then((m) => ({ default: m.WorkerHome })));
const TaskPage = lazy(() => import('./pages/worker/TaskPage').then((m) => ({ default: m.TaskPage })));
const UsersPage = lazy(() => import('./pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })));
const ConfigPage = lazy(() => import('./pages/admin/ConfigPage').then((m) => ({ default: m.ConfigPage })));
const LogsPage = lazy(() => import('./pages/admin/LogsPage').then((m) => ({ default: m.LogsPage })));
// Map and chart libraries are heavy: load them only when needed.
const CommunityMapPage = lazy(() => import('./pages/common/CommunityMapPage'));
const AnalyticsPage = lazy(() => import('./pages/official/AnalyticsPage'));

function Home() {
  const { session, loading, pendingProfile } = useAuth();
  if (loading) return <LoadingState full />;
  if (pendingProfile) return <Navigate to="/welcome" replace />;
  return <Navigate to={session ? HOME[session.claims.role] : '/login'} replace />;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OfflineBanner />
        <Suspense fallback={<LoadingState full />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/welcome" element={<WelcomePage />} />

            <Route element={<RequireRole roles="any" />}>
              <Route element={<RoleShell />}>
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route element={<RequireRole roles={['RESIDENT']} />}>
              <Route element={<ResidentLayout />}>
                <Route path="/resident" element={<ResidentHome />} />
                <Route path="/resident/report/new" element={<NewReportPage />} />
                <Route path="/resident/reports" element={<MyReportsPage />} />
                <Route path="/resident/reports/:id" element={<ResidentReportPage />} />
                <Route path="/resident/alerts" element={<AlertsFeedPage />} />
              </Route>
            </Route>

            <Route element={<RequireRole roles={['RESIDENT', 'OFFICIAL', 'ADMIN']} />}>
              <Route element={<RoleShell />}>
                <Route path="/map" element={<CommunityMapPage />} />
              </Route>
            </Route>

            <Route element={<RequireRole roles={['OFFICIAL', 'ADMIN']} />}>
              <Route element={<StaffLayout />}>
                <Route path="/official" element={<OfficialDashboard />} />
                <Route path="/official/reports" element={<ReportQueuePage />} />
                <Route path="/official/reports/:id" element={<OfficialReportPage />} />
                <Route path="/official/alerts" element={<AlertsAdminPage />} />
                <Route path="/official/alerts/new" element={<NewAlertPage />} />
                <Route path="/official/analytics" element={<AnalyticsPage />} />
              </Route>
            </Route>

            <Route element={<RequireRole roles={['ADMIN']} />}>
              <Route element={<StaffLayout />}>
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/config" element={<ConfigPage />} />
                <Route path="/admin/logs" element={<LogsPage />} />
              </Route>
            </Route>

            <Route element={<RequireRole roles={['FIELD_WORKER']} />}>
              <Route element={<WorkerLayout />}>
                <Route path="/worker" element={<WorkerHome />} />
                <Route path="/worker/tasks/:id" element={<TaskPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
