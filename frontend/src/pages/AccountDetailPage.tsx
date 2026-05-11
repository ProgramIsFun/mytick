import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import type { Account, SecretRef as Secret } from '../types/account';
import { PROVIDERS } from '../constants/accounts';
import SecretPicker from '../components/SecretPicker';

export default function AccountDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [secretIdInputs, setSecretIdInputs] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [browseKey, setBrowseKey] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      Promise.all([api.getAccount(id), api.getSecrets()])
        .then(([account, secrets]) => {
          setAccount(account);
          setSecrets(secrets);
          const inputs: Record<string, string> = {};
          for (const cred of account.credentials) {
            inputs[cred.key] = cred.secretId
              ? (typeof cred.secretId === 'object' ? cred.secretId._id : cred.secretId)
              : '';
          }
          setSecretIdInputs(inputs);
          setLoading(false);
        });
    }
  }, [id]);

  const resolveName = (secretId: string) => {
    const s = secrets.find(s => s._id === secretId);
    return s ? `${s.name} (${s.provider})` : null;
  };

  const handleSave = async (key: string) => {
    if (!id || !account) return;
    setSaving(key);
    try {
      await api.updateAccount(id, {
        credentials: account.credentials.map(c =>
          c.key === key ? { ...c, secretId: secretIdInputs[key] || null } : c
        ),
      });
      const updated = await api.getAccount(id);
      setAccount(updated);
    } catch {
      alert('Failed to update credential');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <Spinner />;
  if (!account) return <div>Account not found</div>;

  const prov = PROVIDERS[account.provider] || PROVIDERS.custom;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <button onClick={() => navigate('/accounts')} className="text-sm text-accent hover:underline mb-2">
          ← Back to Accounts
        </button>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{prov.emoji}</span>
          <div>
            <h1 className="text-3xl font-bold text-text-primary">{account.name}</h1>
            <p className="text-sm text-text-muted mt-1">{prov.label}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-border p-6 space-y-4">
        {account.username && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Username</label>
            <div className="text-sm text-text-primary">{account.username}</div>
          </div>
        )}

        {account.url && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">URL</label>
            <a href={account.url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline break-all">
              {account.url}
            </a>
          </div>
        )}

        {account.notes && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Notes</label>
            <div className="text-sm text-text-primary whitespace-pre-wrap">{account.notes}</div>
          </div>
        )}

        {account.tags.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Tags</label>
            <div className="flex flex-wrap gap-2">
              {account.tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-1 rounded bg-surface-secondary border border-border text-text-primary">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-text-muted block mb-1">Credentials ({account.credentials.length})</label>
          <div className="space-y-3">
            {account.credentials.length === 0 && (
              <div className="text-sm text-text-muted">No credentials configured.</div>
            )}
            {account.credentials.map((cred) => {
              const isEditing = editingKey === cred.key;
              const currentId = secretIdInputs[cred.key] ?? '';
              const resolved = resolveName(currentId);

              return (
                <div key={cred.key} className="bg-surface-secondary p-3 rounded border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-text-muted">{cred.key}</span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={currentId}
                          onChange={e => setSecretIdInputs(prev => ({ ...prev, [cred.key]: e.target.value }))}
                          placeholder="Paste Secret ID..."
                          className="flex-1 text-sm px-2 py-1.5 rounded border border-border bg-surface text-text-primary font-mono placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                        <button
                          onClick={() => setBrowseKey(cred.key)}
                          className="text-xs px-2 py-1.5 rounded border border-border hover:bg-surface-hover text-text-primary"
                        >
                          Browse
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave(cred.key)}
                          disabled={saving === cred.key}
                          className="text-xs px-3 py-1.5 rounded bg-accent text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {saving === cred.key ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="text-xs px-3 py-1.5 rounded border border-border hover:bg-surface-hover text-text-primary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          {resolved ? (
                            <div className="text-xs text-text-muted">→ {resolved}</div>
                          ) : currentId ? (
                            <div className="text-xs text-text-muted font-mono truncate">→ {currentId}</div>
                          ) : (
                            <div className="text-xs text-warning">No secret assigned</div>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingKey(cred.key)}
                          className="ml-3 text-xs px-3 py-1 rounded bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 font-medium shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {account.parentAccountId && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Parent Account</label>
            <button
              onClick={() => navigate(`/accounts/${account.parentAccountId}`)}
              className="text-sm text-accent hover:underline"
            >
              View parent account
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Created</label>
            <p className="text-sm text-text-primary">{new Date(parseInt(account._id.slice(0, 8), 16) * 1000).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {browseKey && (
        <SecretPicker
          secrets={secrets}
          title={`Select Secret for ${browseKey}`}
          onSelect={(secretId) => {
            setSecretIdInputs(prev => ({ ...prev, [browseKey]: secretId }));
            setBrowseKey(null);
          }}
          onClose={() => setBrowseKey(null)}
        />
      )}
    </div>
  );
}
