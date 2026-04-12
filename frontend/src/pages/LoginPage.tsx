import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function LoginPage() {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = isRegister
        ? await api.register({ email, password, name, username })
        : await api.login({ email, password });
      login(res.token, res.user);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: 24 }}>
      <h1>MyTick</h1>
      <h2>{isRegister ? 'Register' : 'Login'}</h2>
      <form onSubmit={handleSubmit}>
        {isRegister && (
          <input
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
          />
        )}
        {isRegister && (
          <input
            placeholder="Username (e.g. john-doe)"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            required
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
        />
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button type="submit" style={{ width: '100%', padding: 10, marginBottom: 8 }}>
          {isRegister ? 'Register' : 'Login'}
        </button>
      </form>
      <button onClick={() => setIsRegister(!isRegister)} style={{ background: 'none', border: 'none', color: 'var(--link)', cursor: 'pointer' }}>
        {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
      </button>
    </div>
  );
}
