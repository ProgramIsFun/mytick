import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PublicTasksPage from './pages/PublicTasksPage';
import SharedTaskPage from './pages/SharedTaskPage';
import TaskDetailPage from './pages/TaskDetailPage';
import SettingsPage from './pages/SettingsPage';
import ProjectsPage from './pages/ProjectsPage';
import { usePushNotifications } from './hooks/usePushNotifications';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  usePushNotifications();
  if (loading) return null;
  return token ? <>{children}</> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) return null;
  return token ? <Navigate to="/" /> : <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/tasks/:id" element={<PrivateRoute><TaskDetailPage /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
            <Route path="/projects" element={<PrivateRoute><ProjectsPage /></PrivateRoute>} />
            <Route path="/share/:token" element={<SharedTaskPage />} />
            <Route path="/@:username/tasks" element={<PublicTasksPage />} />
          </Routes>
          <Footer />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

function Footer() {
  const { theme, toggle } = useTheme();
  return (
    <div className="mt-10 pt-4 border-t border-border-light text-center text-xs text-text-muted">
      <button onClick={toggle} className="text-xs px-2 py-1 mr-2 rounded hover:bg-surface-hover border border-border">{theme === 'light' ? '🌙' : '☀️'}</button>
      v1.1.0{import.meta.env.DEV && ` · API: ${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}`}
    </div>
  );
}
