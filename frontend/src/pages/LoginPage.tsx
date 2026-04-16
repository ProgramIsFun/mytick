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

  const inputCls = "w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors";

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary">MyTick</h1>
          <p className="text-sm text-text-muted mt-1">Task management for developers</p>
        </div>

        <div className="border border-border rounded-lg bg-surface-secondary p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            {isRegister ? 'Create an account' : 'Sign in'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isRegister && (
              <input
                placeholder="Name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className={inputCls}
              />
            )}
            {isRegister && (
              <input
                placeholder="Username (e.g. john-doe)"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                className={inputCls}
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className={inputCls}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className={inputCls}
            />

            {error && (
              <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md">{error}</div>
            )}

            <button
              type="submit"
              className="w-full py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              {isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-sm text-accent hover:underline bg-transparent border-none cursor-pointer"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
