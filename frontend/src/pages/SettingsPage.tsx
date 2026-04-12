import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

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
    </div>
  );
}
