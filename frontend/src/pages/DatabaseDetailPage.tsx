import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';

interface SecretRef {
  provider: 'bitwarden' | '1password' | 'lastpass' | 'vault' | 'aws_secrets' | 'custom';
  itemId: string;
  field?: string;
}

interface Account { _id: string; name: string; provider: string; }
interface Secret { _id: string; name: string; provider: string; }
interface Database {
  _id: string; name: string; type: string; host: string; port: number | null;
  database: string; secretRefs: SecretRef[]; secretId?: Secret | string | null; backupEnabled: boolean;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.getDatabase(id).then(setDb).finally(() => setLoading(false));
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
              onClick={() => navigate(`/accounts/${db.accountId._id}`)}
              className="text-sm text-accent hover:underline"
            >
              {db.accountId.name}
            </button>
          </div>
        )}

        {db.secretId && typeof db.secretId === 'object' && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Secret</label>
            <button
              onClick={() => navigate(`/secrets/${db.secretId._id}`)}
              className="text-sm text-accent hover:underline"
            >
              {db.secretId.name} ({db.secretId.provider})
            </button>
          </div>
        )}

        {db.secretRefs.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Secret References ({db.secretRefs.length})</label>
            <div className="space-y-2">
              {db.secretRefs.map((ref, idx) => (
                <div key={idx} className="text-sm bg-surface-secondary p-3 rounded border border-border">
                  <div className="text-xs text-text-muted mb-1">
                    {ref.provider} - {ref.itemId}
                    {ref.field && <span className="ml-2">field: {ref.field}</span>}
                  </div>
                </div>
              ))}
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
    </div>
  );
}
