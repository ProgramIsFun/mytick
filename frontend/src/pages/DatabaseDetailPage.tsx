import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';

interface Account { _id: string; name: string; provider: string; }
interface Secret { _id: string; name: string; provider: string; }
interface Database {
  _id: string; name: string; type: string; host: string; port: number | null;
  database: string; secretId?: Secret | string | null; backupEnabled: boolean;
  backupRetentionDays: number; backupFrequency: string; lastBackupAt: string | null;
  accountId: Account | null; tags: string[]; notes: string;
  createdAt: string;
}

const DB_TYPES: Record<string, { emoji: string; label: string }> = {
  mongodb: { emoji: '🍃', label: 'MongoDB' },
  postgres: { emoji: '🐘', label: 'PostgreSQL' },
  mysql: { emoji: '🐬', label: 'MySQL' },
  redis: { emoji: '🔴', label: 'Redis' },
  sqlite: { emoji: '💾', label: 'SQLite' },
  other: { emoji: '🗄️', label: 'Other' },
};

export default function DatabaseDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [db, setDb] = useState<Database | null>(null);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSecretModal, setShowSecretModal] = useState(false);

  useEffect(() => {
    if (id) {
      Promise.all([api.getDatabase(id), api.getSecrets()])
        .then(([db, secrets]) => {
          setDb(db);
          setSecrets(secrets);
          setLoading(false);
        });
    }
  }, [id]);

  if (loading) return <Spinner />;
  if (!db) return <div>Database not found</div>;

  const dbType = DB_TYPES[db.type] || DB_TYPES.other;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <button onClick={() => navigate('/databases')} className="text-sm text-accent hover:underline mb-2">
          ← Back to Databases
        </button>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{dbType.emoji}</span>
          <div>
            <h1 className="text-3xl font-bold text-text-primary">{db.name}</h1>
            <p className="text-sm text-text-muted mt-1">{dbType.label}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Host</label>
            <div className="text-sm text-text-primary font-mono">{db.host}</div>
          </div>
          {db.port && (
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Port</label>
              <div className="text-sm text-text-primary font-mono">{db.port}</div>
            </div>
          )}
        </div>

        {db.database && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Database</label>
            <div className="text-sm text-text-primary">{db.database}</div>
          </div>
        )}

        {db.accountId && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Account</label>
            <button
              onClick={() => navigate(`/accounts/${db.accountId!._id}`)}
              className="text-sm text-accent hover:underline"
            >
              {db.accountId.name}
            </button>
          </div>
        )}

        {db.secretId && typeof db.secretId === 'object' ? (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Secret</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/secrets/${(db.secretId as Secret)._id}`)}
                className="text-sm text-accent hover:underline"
              >
                {db.secretId.name} ({db.secretId.provider})
              </button>
              <button
                onClick={() => setShowSecretModal(true)}
                className="text-xs px-2 py-0.5 rounded border border-border hover:bg-surface-hover"
              >
                ✏️ Update
              </button>
            </div>
          </div>
        ) : db.secretId ? (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Secret</label>
            <div className="flex items-center gap-2">
              <div className="text-xs text-warning">
                ⚠️ Secret reference missing
              </div>
              <button
                onClick={() => setShowSecretModal(true)}
                className="text-xs px-2 py-0.5 rounded border border-border hover:bg-surface-hover"
              >
                ✏️ Select Secret
              </button>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Secret</label>
            <div className="flex items-center gap-2">
              <div className="text-xs text-text-muted">No secret configured</div>
              <button
                onClick={() => setShowSecretModal(true)}
                className="text-xs px-2 py-0.5 rounded border border-border hover:bg-surface-hover"
              >
                ✏️ Select Secret
              </button>
            </div>
          </div>
        )}



        {db.notes && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Notes</label>
            <div className="text-sm text-text-primary whitespace-pre-wrap">{db.notes}</div>
          </div>
        )}

        {db.tags.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Tags</label>
            <div className="flex flex-wrap gap-2">
              {db.tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-1 rounded bg-surface-secondary border border-border text-text-primary">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Backup Enabled</label>
            <div className="text-sm text-text-primary">{db.backupEnabled ? 'Yes' : 'No'}</div>
          </div>
          {db.backupEnabled && (
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Backup Retention</label>
              <div className="text-sm text-text-primary">{db.backupRetentionDays} days</div>
            </div>
          )}
          {db.lastBackupAt && (
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Last Backup</label>
              <div className="text-sm text-text-primary">{new Date(db.lastBackupAt).toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal for updating secret reference */}
      {showSecretModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-lg border border-border p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-text-primary mb-4">Update Secret</h2>
            <p className="text-sm text-text-muted mb-4">Select an existing secret or create a new one.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              <button
                onClick={() => {
                  setShowSecretModal(false);
                  navigate('/secrets/new');
                }}
                className="w-full text-left px-3 py-2 rounded border border-border hover:bg-surface-hover text-sm"
              >
                + Create New Secret
              </button>
              {secrets.map(secret => (
                <button
                  key={secret._id}
                  onClick={async () => {
                    try {
                      await api.updateDatabase(id!, { secretId: secret._id });
                      // Reload database to get updated data
                      const updatedDb = await api.getDatabase(id!);
                      setDb(updatedDb);
                      alert('Secret ID updated successfully!');
                      setShowSecretModal(false);
                    } catch (err) {
                      alert('Failed to update secret ID');
                    }
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
                onClick={() => setShowSecretModal(false)}
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
