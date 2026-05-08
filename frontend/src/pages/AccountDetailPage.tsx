import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';

interface Secret { _id: string; name: string; provider: string; }
interface Credential { key: string; secretId: Secret | string; }
interface Account {
  _id: string; name: string; provider: string; url: string;
  username: string; notes: string; tags: string[]; credentials: Credential[];
  parentAccountId: string | null;
}

const PROVIDERS: Record<string, { emoji: string; label: string }> = {
  mongodb_atlas: { emoji: '🍃', label: 'MongoDB Atlas' },
  firebase: { emoji: '🔥', label: 'Firebase' },
  render: { emoji: '🚀', label: 'Render' },
  aws: { emoji: '☁️', label: 'AWS' },
  stripe: { emoji: '💳', label: 'Stripe' },
  github: { emoji: '🐙', label: 'GitHub' },
  banking: { emoji: '🏦', label: 'Banking' },
  email: { emoji: '📧', label: 'Email' },
  custom: { emoji: '⚙️', label: 'Custom' },
};

export default function AccountDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCredential, setEditingCredential] = useState<{ key: string; secretId?: Secret | string | null } | null>(null);

  useEffect(() => {
    if (id) {
      Promise.all([
        api.getAccount(id).then(setAccount),
        api.getSecrets().then(setSecrets)
      ]).then(([_, secrets]) => setSecrets(secrets));
      setLoading(false);
    }
  }, [id]);

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

        {account.credentials.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Credentials ({account.credentials.length})</label>
            <div className="space-y-2">
              {account.credentials.map((cred, idx) => (
                <div key={idx} className="text-sm bg-surface-secondary p-3 rounded border border-border">
                  <div className="text-xs text-text-muted mb-1">Key: {cred.key}</div>
                  {cred.secretId && typeof cred.secretId === 'object' ? (
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-text-muted">
                        Secret: {cred.secretId.name} ({cred.secretId.provider})
                      </div>
                      <button
                        onClick={() => setEditingCredential({ ...cred, secretId: cred.secretId })}
                        className="text-xs px-2 py-0.5 rounded border border-border hover:bg-surface-hover"
                      >
                        ✏️ Update
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-warning">
                        ⚠️ Secret reference missing
                      </div>
                      <button
                        onClick={() => setEditingCredential({ ...cred, secretId: null })}
                        className="text-xs px-2 py-0.5 rounded border border-border hover:bg-surface-hover"
                      >
                        ✏️ Select Secret
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
            <p className="text-sm text-text-primary">{new Date(account._id.slice(0, 8), 16).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Modal for updating secret reference */}
      {editingCredential && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-lg border border-border p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-text-primary mb-4">Update Secret for {editingCredential.key}</h2>
            <p className="text-sm text-text-muted mb-4">Select an existing secret or create a new one.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              <button
                onClick={async () => {
                  const res = await api.getSecrets();
                  if (res.length > 0) {
                    setAccount(prev => {
                      if (!prev) return null;
                      const newCreds = prev.credentials.map(c => 
                        c.key === editingCredential.key 
                          ? { ...c, secretId: res[0] } 
                          : c
                      );
                      return { ...prev, credentials: newCreds };
                    });
                    setEditingCredential(null);
                  }
                }}
                className="w-full text-left px-3 py-2 rounded border border-border hover:bg-surface-hover text-sm"
              >
                + Create New Secret
              </button>
              {secrets.map(secret => (
                <button
                  key={secret._id}
                  onClick={async () => {
                    setAccount(prev => {
                      if (!prev) return null;
                      const newCreds = prev.credentials.map(c => 
                        c.key === editingCredential.key 
                          ? { ...c, secretId: secret } 
                          : c
                      );
                      return { ...prev, credentials: newCreds };
                    });
                    setEditingCredential(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded border border-border hover:bg-surface-hover text-sm flex items-center gap-2"
                >
                  <span>{secret.name}</span>
                  <span className="text-xs text-text-muted">({secret.provider})</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingCredential(null)}
                className="px-4 py-2 rounded border border-border hover:bg-surface-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
