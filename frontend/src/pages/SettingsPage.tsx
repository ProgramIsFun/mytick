import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { requestNotificationPermission } from '../firebase';

// --- DEBUG SECTION START --- Remove this entire section for production
function DebugPushSection() {
  const [pushStatus, setPushStatus] = useState('');
  const [fcmToken, setFcmToken] = useState('');
  const [notifPermission, setNotifPermission] = useState(Notification.permission);
  const [storedTokens, setStoredTokens] = useState<string[]>([]);

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
    <>
      <hr style={{ margin: '24px 0' }} />
      <h3>🛠 Push Notifications (Debug)</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Permission: <strong>{notifPermission}</strong>
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
        FCM Token: <strong>{fcmToken || 'Not registered'}</strong>
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button onClick={handleRegisterToken} style={{ padding: '10px 20px' }}>📝 Register Token</button>
        <button onClick={() => handleTestPush()} style={{ padding: '10px 20px' }}>🔔 Push All</button>
      </div>
      {pushStatus && <p style={{ fontSize: 14, marginTop: 8 }}>{pushStatus}</p>}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
        <strong>Stored tokens ({storedTokens.length}):</strong>
      </p>
      {storedTokens.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'monospace', margin: 0, flex: 1 }}>
            {i + 1}. {t}
          </p>
          <button onClick={() => handleTestPush(i)} style={{ fontSize: 10, padding: '2px 8px', whiteSpace: 'nowrap' }}>🔔 Push</button>
        </div>
      ))}
    </>
  );
}
// --- DEBUG SECTION END ---

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
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 24 }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: 16 }}>← Back</button>
      <h1>Settings</h1>

      <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 'bold' }}>Username</label>
      <input
        value={username}
        onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
        style={{ display: 'block', width: '100%', padding: 8, marginBottom: 16, boxSizing: 'border-box' }}
      />

      <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 'bold' }}>Display Name</label>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        style={{ display: 'block', width: '100%', padding: 8, marginBottom: 16, boxSizing: 'border-box' }}
      />

      <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 'bold' }}>New Password</label>
      <input
        type="password"
        placeholder="Leave blank to keep current"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        style={{ display: 'block', width: '100%', padding: 8, marginBottom: 16, boxSizing: 'border-box' }}
      />

      {error && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
      {success && <p style={{ color: 'green', fontSize: 14 }}>{success}</p>}

      <button onClick={handleSave} style={{ padding: '10px 20px' }}>Save</button>

      {/* --- DEBUG: Remove DebugPushSection for production --- */}
      <DebugPushSection />
    </div>
  );
}
