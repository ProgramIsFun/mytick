import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { requestNotificationPermission } from '../firebase';

const inputCls = "w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors";

function DebugPushSection() {
  const [pushStatus, setPushStatus] = useState('');
  const [fcmToken, setFcmToken] = useState('');
  const [notifPermission, setNotifPermission] = useState(Notification.permission);
  const [storedTokens, setStoredTokens] = useState<{ token: string; provider: string; device: string; registeredAt: string | null }[]>([]);

  useEffect(() => {
    setNotifPermission(Notification.permission);
    api.getFcmTokens().then(r => setStoredTokens(r.tokens)).catch(() => {});
  }, []);

  const handleRegisterToken = async () => {
    setPushStatus('Requesting permission...');
    try {
      const token = await requestNotificationPermission();
      setNotifPermission(Notification.permission);
      if (!token) { setPushStatus('❌ Permission denied or token failed'); return; }
      setFcmToken(token);
      await api.registerFcmToken(token);
      setPushStatus('✅ Token registered');
      api.getFcmTokens().then(r => setStoredTokens(r.tokens)).catch(() => {});
    } catch (e: any) { setPushStatus(`❌ ${e.message}`); }
  };

  const handleTestPush = async (tokenIndex?: number) => {
    setPushStatus('Sending...');
    try {
      const res = await api.testPush(tokenIndex);
      setPushStatus(`✅ Sent to ${res.tokens} device(s)`);
    } catch (e: any) { setPushStatus(`❌ ${e.message}`); }
  };

  return (
    <div className="border border-border rounded-lg p-5 bg-surface mt-6">
      <h3 className="text-sm font-semibold text-text-primary mb-3">🛠 Push Notifications (Debug)</h3>
      <div className="space-y-1 text-xs text-text-muted">
        <p>Permission: <strong className="text-text-primary">{notifPermission}</strong></p>
        <p className="break-all">FCM Token: <strong className="text-text-primary">{fcmToken || 'Not registered'}</strong></p>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={handleRegisterToken} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-surface-hover transition-colors">📝 Register Token</button>
        <button onClick={() => handleTestPush()} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-surface-hover transition-colors">🔔 Push All</button>
      </div>
      {pushStatus && <p className="text-xs mt-2 text-text-secondary">{pushStatus}</p>}
      {storedTokens.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-text-muted mb-2">Stored tokens ({storedTokens.length}):</p>
          {storedTokens.map((t, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 border-t border-border-light">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-text-muted font-mono truncate">{i + 1}. [{t.provider}] {t.token}</p>
                <p className="text-[9px] text-text-muted">{t.device?.slice(0, 80) || 'unknown'}{t.registeredAt ? ` · ${new Date(t.registeredAt).toLocaleString()}` : ''}</p>
              </div>
              <button onClick={() => handleTestPush(i)} className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-surface-hover shrink-0">🔔</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user, login: setUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [name, setName] = useState(user?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async () => {
    setError(''); setSuccess('');
    try {
      const data: any = { username, name };
      if (newPassword) data.newPassword = newPassword;
      const updated = await api.updateMe(data);
      const token = localStorage.getItem('token')!;
      setUser(token, updated);
      setNewPassword('');
      setSuccess('Profile updated');
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-sm text-text-muted hover:text-text-primary transition-colors">← Back</button>
          <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="border border-border rounded-lg p-5 bg-surface space-y-4">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Username</label>
            <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">New Password</label>
            <input type="password" placeholder="Leave blank to keep current" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} />
          </div>

          {error && <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md">{error}</div>}
          {success && <div className="text-sm text-success bg-success/10 px-3 py-2 rounded-md">{success}</div>}

          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors">
            Save changes
          </button>
        </div>

        <DebugPushSection />
      </main>
    </div>
  );
}
