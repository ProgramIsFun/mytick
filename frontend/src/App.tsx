import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PublicTasksPage from './pages/PublicTasksPage';
import SharedTaskPage from './pages/SharedTaskPage';
import TaskDetailPage from './pages/TaskDetailPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/tasks/:id" element={<PrivateRoute><TaskDetailPage /></PrivateRoute>} />
          <Route path="/share/:token" element={<SharedTaskPage />} />
          <Route path="/:userId/tasks" element={<PublicTasksPage />} />
        </Routes>
        <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #eee', fontSize: 12, color: '#aaa', textAlign: 'center' }}>
          v1.1.0
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
