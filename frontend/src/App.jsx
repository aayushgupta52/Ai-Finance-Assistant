import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.js';
import { api, authApi } from './services/api.js';
import { useThemeStore } from './store/theme.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Lazily load feature pages so heavy deps (recharts, etc.) split into their own
// chunks and don't bloat the initial bundle.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Insights = lazy(() => import('./pages/Insights.jsx'));
const Chat = lazy(() => import('./pages/Chat.jsx'));
const Upload = lazy(() => import('./pages/Upload.jsx'));
const Budgets = lazy(() => import('./pages/Budgets.jsx'));
const Goals = lazy(() => import('./pages/Goals.jsx'));
const Split = lazy(() => import('./pages/Split.jsx'));
const Subscriptions = lazy(() => import('./pages/Subscriptions.jsx'));
const Tax = lazy(() => import('./pages/Tax.jsx'));
const Calculators = lazy(() => import('./pages/Calculators.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));

const PageFallback = () => (
  <div className="grid h-64 place-items-center text-slate-400">Loading…</div>
);

// Handles the Google OAuth redirect: token arrives in the URL fragment.
function AuthCallback() {
  const navigate = useNavigate();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('access_token');
    if (!token) return navigate('/login?error=missing_token', { replace: true });

    setAccessToken(token);
    authApi
      .me()
      .then(({ user }) => {
        setSession({ user, accessToken: token });
        navigate('/', { replace: true });
      })
      .catch(() => navigate('/login?error=session_failed', { replace: true }));
  }, [navigate, setAccessToken, setSession]);

  return <div className="grid h-full place-items-center text-slate-500">Signing you in…</div>;
}

export default function App() {
  const { status, setSession, clear } = useAuthStore();

  // Apply the persisted theme (light/dark) as early as possible.
  useEffect(() => {
    useThemeStore.getState().apply();
  }, []);

  // On first load, try to restore a session via the refresh cookie.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        const accessToken = data?.data?.accessToken;
        if (!accessToken) throw new Error('no token');
        useAuthStore.getState().setAccessToken(accessToken);
        const { user } = await authApi.me();
        if (active) setSession({ user, accessToken });
      } catch {
        if (active) clear();
      }
    })();
    return () => {
      active = false;
    };
  }, [setSession, clear]);

  if (status === 'loading') {
    return <div className="grid h-full place-items-center text-slate-500">Loading…</div>;
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/split" element={<Split />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/tax" element={<Tax />} />
          <Route path="/calculators" element={<Calculators />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
