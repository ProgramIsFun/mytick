import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';

interface UsedBy {
  collection: string;
  itemId: string;
  itemName: string;
}

interface Secret {
  _id: string;
  name: string;
  description: string;
  provider: 'bitwarden' | '1password' | 'lastpass' | 'vault' | 'aws_secrets' | 'custom';
  providerSecretId: string;
  type: 'api_key' | 'password' | 'connection_string' | 'certificate' | 'token' | 'other';
  tags: string[];
  usedBy: UsedBy[];
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROVIDERS: Record<string, { emoji: string; label: string }> = {
  bitwarden: { emoji: '🔐', label: 'Bitwarden' },
  '1password': { emoji: '🔑', label: '1Password' },
  lastpass: { emoji: '🔒', label: 'LastPass' },
  vault: { emoji: '🏦', label: 'Vault' },
  aws_secrets: { emoji: '☁️', label: 'AWS Secrets' },
  custom: { emoji: '⚙️', label: 'Custom' },
};

const TYPES: Record<string, { emoji: string; label: string }> = {
  api_key: { emoji: '🔑', label: 'API Key' },
  password: { emoji: '🔒', label: 'Password' },
  connection_string: { emoji: '🔗', label: 'Connection String' },
  certificate: { emoji: '📜', label: 'Certificate' },
  token: { emoji: '🎫', label: 'Token' },
  other: { emoji: '📦', label: 'Other' },
};

export default function SecretsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    if (id) {
      // Load single secret
      fetch(`/api/secrets/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then(res => res.json())
        .then(setSecret)
        .finally(() => setLoading(false));
    } else {
      // Load all secrets
      fetch(`/api/secrets${search ? `?search=${search}` : ''}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then(res => res.json())
        .then(setSecrets)
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (!id) { const t = setTimeout(load, 300); return () => clearTimeout(t); } }, [search]);

  if (loading) return <Spinner />;

  // Detail view
  if (id && secret) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <button onClick={() => navigate('/secrets')} className="text-sm text-accent hover:underline mb-2">
            ← Back to Secrets
          </button>
          <h1 className="text-3xl font-bold text-text-primary">{secret.name}</h1>
          <p className="text-sm text-text-muted mt-1">{secret.description}</p>
        </div>

        <div className="bg-surface rounded-lg border border-border p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Provider</label>
            <div className="text-sm text-text-primary">
              {PROVIDERS[secret.provider]?.emoji} {PROVIDERS[secret.provider]?.label}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Type</label>
            <div className="text-sm text-text-primary">
              {TYPES[secret.type]?.emoji} {TYPES[secret.type]?.label}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Provider Secret ID</label>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-surface-secondary px-2 py-1 rounded border border-border flex-1">
                {secret.providerSecretId}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(secret.providerSecretId)}
                className="text-xs px-2 py-1 rounded border border-border hover:bg-surface-hover"
              >
                📋 Copy
              </button>
            </div>
          </div>

          {secret.tags.length > 0 && (
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Tags</label>
              <div className="flex flex-wrap gap-2">
                {secret.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-1 rounded bg-surface-secondary border border-border text-text-primary">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Used By ({secret.usedBy.length})</label>
            <div className="space-y-2">
              {secret.usedBy.map((usage, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-1 rounded bg-surface-secondary border border-border text-text-muted text-xs">
                    {usage.collection}
                  </span>
                  <button
                    onClick={() => navigate(`/${usage.collection}?highlight=${usage.itemId}`)}
                    className="text-accent hover:underline"
                  >
                    {usage.itemName} →
                  </button>
                </div>
              ))}
              {secret.usedBy.length === 0 && (
                <p className="text-sm text-text-muted italic">Not currently used</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Created</label>
              <p className="text-sm text-text-primary">{new Date(secret.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Last Accessed</label>
              <p className="text-sm text-text-primary">
                {secret.lastAccessedAt ? new Date(secret.lastAccessedAt).toLocaleString() : 'Never'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-text-primary">🔐 Secrets</h1>
      </div>

      <input
        type="text"
        placeholder="Search secrets..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 mb-4 rounded-md border border-border bg-surface text-text-primary"
      />

      <div className="space-y-2">
        {secrets.map(s => (
          <div
            key={s._id}
            onClick={() => navigate(`/secrets/${s._id}`)}
            className="bg-surface border border-border rounded-lg p-4 hover:bg-surface-hover cursor-pointer transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-primary">{s.name}</h3>
                <p className="text-sm text-text-muted mt-1">{s.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs px-2 py-1 rounded bg-surface-secondary border border-border">
                    {PROVIDERS[s.provider]?.emoji} {PROVIDERS[s.provider]?.label}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-surface-secondary border border-border">
                    {TYPES[s.type]?.emoji} {TYPES[s.type]?.label}
                  </span>
                  <span className="text-xs text-text-muted">
                    Used by {s.usedBy.length} resource{s.usedBy.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {secrets.length === 0 && (
          <p className="text-center text-text-muted py-12">No secrets found</p>
        )}
      </div>
    </div>
  );
}
