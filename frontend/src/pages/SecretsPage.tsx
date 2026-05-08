import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Spinner from '../components/Spinner';

interface Secret {
  _id: string;
  name: string;
  description: string;
  provider: 'bitwarden' | 'bitwarden_sm' | '1password' | 'lastpass' | 'vault' | 'aws_secrets' | 'custom';
  providerSecretId: string;
  type: 'api_key' | 'password' | 'connection_string' | 'certificate' | 'token' | 'other';
  tags: string[];
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROVIDERS: Record<string, { emoji: string; label: string }> = {
  bitwarden: { emoji: '🔐', label: 'Bitwarden' },
  bitwarden_sm: { emoji: '🔐', label: 'Bitwarden SM' },
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
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    provider: Secret['provider'];
    providerSecretId: string;
    type: Secret['type'];
    tags: string[];
  }>({
    name: '',
    description: '',
    provider: 'bitwarden',
    providerSecretId: '',
    type: 'api_key',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    if (id) {
      // Load single secret
      fetch(`${API}/secrets/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then(res => res.json())
        .then(setSecret)
        .finally(() => setLoading(false));
    } else {
      // Load all secrets
      fetch(`${API}/secrets${search ? `?search=${search}` : ''}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then(res => res.json())
        .then(setSecrets)
        .finally(() => setLoading(false));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.providerSecretId) {
      alert('Name and Provider Secret ID are required');
      return;
    }

    setSubmitting(true);
    try {
      const method = isEditing ? 'PATCH' : 'POST';
      const path = isEditing ? `/secrets/${secret?._id}` : '/secrets';
      
      const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${API}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowForm(false);
        setFormData({
          name: '',
          description: '',
          provider: 'bitwarden',
          providerSecretId: '',
          type: 'api_key',
          tags: [],
        });
        setTagInput('');
        load();
      } else {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        alert(err.error || 'Error saving secret');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!secret || !window.confirm('Delete this secret? This action cannot be undone.')) return;

    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${API}/secrets/${secret._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (res.ok) {
        navigate('/secrets');
      } else {
        alert('Error deleting secret');
      }
    } catch (err) {
      alert('Error deleting secret');
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (!id) { const t = setTimeout(load, 300); return () => clearTimeout(t); } }, [search]);

  if (loading) return <Spinner />;

  // Detail view - handle missing secret
  if (id && !secret) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <button onClick={() => navigate('/secrets')} className="text-sm text-accent hover:underline mb-2">
            ← Back to Secrets
          </button>
          <h1 className="text-3xl font-bold text-text-primary">Secret Not Found</h1>
          <p className="text-sm text-text-muted mt-1">The secret you're looking for may have been deleted or doesn't exist.</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-6 space-y-4">
          <p className="text-sm text-text-primary">
            If this secret was linked from another page, you may need to update the secret reference.
          </p>
          <button
            onClick={() => navigate('/secrets')}
            className="px-4 py-2 rounded bg-accent text-white hover:bg-opacity-90"
          >
            Go to Secrets List
          </button>
        </div>
      </div>
    );
  }

  // Detail view
  if (id && secret) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <button onClick={() => navigate('/secrets')} className="text-sm text-accent hover:underline mb-2">
            ← Back to Secrets
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-text-primary">{secret.name}</h1>
              <p className="text-sm text-text-muted mt-1">{secret.description}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsEditing(true);
                  setFormData({
                    name: secret.name,
                    description: secret.description,
                    provider: secret.provider,
                    providerSecretId: secret.providerSecretId,
                    type: secret.type,
                    tags: secret.tags,
                  });
                  setShowForm(true);
                }}
                className="px-4 py-2 rounded bg-accent text-white text-sm hover:bg-opacity-90"
              >
                ✏️ Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
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
  if (showForm) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <button onClick={() => {
            setShowForm(false);
            setIsEditing(false);
            setFormData({
              name: '',
              description: '',
              provider: 'bitwarden',
              providerSecretId: '',
              type: 'api_key',
              tags: [],
            });
          }} className="text-sm text-accent hover:underline mb-2">
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-text-primary">{isEditing ? 'Edit Secret' : 'Create Secret'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded-lg border border-border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 rounded border border-border bg-surface-secondary text-text-primary"
              placeholder="e.g., Production MongoDB"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 rounded border border-border bg-surface-secondary text-text-primary"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Provider *</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value as any }))}
                className="w-full px-3 py-2 rounded border border-border bg-surface-secondary text-text-primary"
              >
                <option value="bitwarden">🔐 Bitwarden</option>
                <option value="bitwarden_sm">🔐 Bitwarden SM</option>
                <option value="1password">🔑 1Password</option>
                <option value="lastpass">🔒 LastPass</option>
                <option value="vault">🏦 Vault</option>
                <option value="aws_secrets">☁️ AWS Secrets</option>
                <option value="custom">⚙️ Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full px-3 py-2 rounded border border-border bg-surface-secondary text-text-primary"
              >
                <option value="api_key">🔑 API Key</option>
                <option value="password">🔒 Password</option>
                <option value="connection_string">🔗 Connection String</option>
                <option value="certificate">📜 Certificate</option>
                <option value="token">🎫 Token</option>
                <option value="other">📦 Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Provider Secret ID *</label>
            <input
              type="text"
              value={formData.providerSecretId}
              onChange={(e) => setFormData(prev => ({ ...prev, providerSecretId: e.target.value }))}
              className="w-full px-3 py-2 rounded border border-border bg-surface-secondary text-text-primary"
               placeholder="e.g., Bitwarden SM secret ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Tags</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1 px-3 py-2 rounded border border-border bg-surface-secondary text-text-primary text-sm"
                placeholder="Add a tag and press Enter"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 rounded border border-border text-sm hover:bg-surface-hover"
              >
                Add
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-secondary border border-border text-text-primary text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-text-muted hover:text-text-primary"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded bg-accent text-white hover:bg-opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : isEditing ? 'Update Secret' : 'Create Secret'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setIsEditing(false);
              }}
              className="px-4 py-2 rounded border border-border hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-text-primary">🔐 Secrets</h1>
        <button
          onClick={() => {
            setIsEditing(false);
            setFormData({
              name: '',
              description: '',
              provider: 'bitwarden',
              providerSecretId: '',
              type: 'api_key',
              tags: [],
            });
            setShowForm(true);
          }}
          className="px-4 py-2 rounded bg-accent text-white hover:bg-opacity-90"
        >
          + Create Secret
        </button>
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
