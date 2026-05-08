import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
interface BackupRecord {
  _id: string; status: 'success' | 'failed' | 'partial';
  startedAt: string; completedAt: string; durationMs: number;
  sizeBytes: number; s3Path: string; s3Bucket: string;
  errorMessage?: string; triggeredBy: 'scheduled' | 'manual';
  databaseId: { _id: string; name: string; type: string } | string;
}

const DB_TYPES: Record<string, { emoji: string; label: string }> = {
  mongodb: { emoji: '🍃', label: 'MongoDB' },
  postgres: { emoji: '🐘', label: 'PostgreSQL' },
  mysql: { emoji: '🐬', label: 'MySQL' },
  redis: { emoji: '🔴', label: 'Redis' },
  sqlite: { emoji: '💾', label: 'SQLite' },
  other: { emoji: '🗄️', label: 'Other' },
};

const inputCls = "w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40";

function formatSize(bytes: number) {
  if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDuration(ms: number) {
  if (ms > 60000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 1000).toFixed(0)}s`;
}

export default function DatabasesPage() {
  const navigate = useNavigate();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'mongodb', host: '', port: '', database: '',
    secretId: '',
    backupEnabled: false, backupRetentionDays: 30, backupFrequency: 'daily',
    accountId: '', notes: ''
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [allBackups, setAllBackups] = useState<BackupRecord[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getDatabases(search || undefined).then(setDatabases),
      api.getSecrets().then(setSecrets),
      api.getAccounts().then(setAccounts)
    ]).finally(() => setLoading(false));
  };

  const loadBackups = () => {
    setBackupsLoading(true);
    api.getAllBackupHistory(100).then(setAllBackups).finally(() => setBackupsLoading(false));
  };

  useEffect(() => { load(); loadBackups(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.type) return;
    await api.createDatabase({
      name: form.name,
      type: form.type,
      host: form.host,
      port: form.port ? parseInt(form.port) : null,
      database: form.database,
      secretId: form.secretId || null,
      backupEnabled: form.backupEnabled,
      backupRetentionDays: form.backupRetentionDays,
      backupFrequency: form.backupFrequency,
      accountId: form.accountId || null,
      notes: form.notes,
    });
    setForm({
      name: '', type: 'mongodb', host: '', port: '', database: '',
      secretId: '',
      backupEnabled: false, backupRetentionDays: 30, backupFrequency: 'daily',
      accountId: '', notes: ''
    });
    setCreating(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this database entry?')) return;
    await api.deleteDatabase(id);
    load();
  };

  const toggleBackup = async (id: string, enabled: boolean) => {
    await api.updateDatabase(id, { backupEnabled: !enabled });
    load();
  };

  const timeSince = (date: string | null) => {
    if (!date) return 'Never';
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const getDbName = (dbId: BackupRecord['databaseId']) => {
    if (typeof dbId === 'object' && dbId !== null) return dbId.name;
    return '';
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-sm text-text-muted hover:text-text-primary">← Back</button>
          <h1 className="text-lg font-semibold text-text-primary">Databases</h1>
          <span className="text-xs text-text-muted">{databases.length} databases</span>
          <div className="flex-1" />
          <button onClick={() => setCreating(!creating)} className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover">
            + New
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {creating && (
          <form onSubmit={handleCreate} className="border border-border rounded-lg p-4 bg-surface mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Database name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} required />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls}>
                {Object.entries(DB_TYPES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>
            <div className="border border-border rounded-lg p-3 bg-surface-secondary">
              <label className="text-xs font-medium text-text-muted block mb-2">Secret (optional)</label>
              <select value={form.secretId} onChange={e => setForm({ ...form, secretId: e.target.value })} className={inputCls}>
                <option value="">No secret</option>
                {secrets.map(s => <option key={s._id} value={s._id}>{s.name} ({s.provider})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input placeholder="Host" value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} className={inputCls} />
              <input placeholder="Port" type="number" value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} className={inputCls} />
              <input placeholder="DB Name" value={form.database} onChange={e => setForm({ ...form, database: e.target.value })} className={inputCls} />
            </div>
            <select value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} className={inputCls}>
              <option value="">No linked account</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.name} ({a.provider})</option>)}
            </select>
            <div className="border border-border rounded-lg p-3 bg-surface-secondary">
              <label className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={form.backupEnabled} onChange={e => setForm({ ...form, backupEnabled: e.target.checked })} className="rounded accent-accent" />
                <span className="text-sm text-text-primary">Enable automated backups</span>
              </label>
              {form.backupEnabled && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Retention (days)</label>
                    <input type="number" value={form.backupRetentionDays} onChange={e => setForm({ ...form, backupRetentionDays: parseInt(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Frequency</label>
                    <select value={form.backupFrequency} onChange={e => setForm({ ...form, backupFrequency: e.target.value })} className={inputCls}>
                      <option value="hourly">Hourly</option>
                      <option value="6hours">Every 6 Hours</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
            <div className="flex gap-2">
              <button type="submit" className="text-sm px-4 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover">Create</button>
              <button type="button" onClick={() => setCreating(false)} className="text-sm px-4 py-1.5 rounded-md border border-border text-text-secondary hover:bg-surface-hover">Cancel</button>
            </div>
          </form>
        )}

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search databases..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={inputCls}
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : databases.length === 0 ? (
              <div className="text-center py-12 text-text-muted text-sm">No databases found. Create one to get started.</div>
            ) : (
              <div className="space-y-2">
                {databases.map(db => {
                  const dbType = DB_TYPES[db.type] || DB_TYPES.other;

                  return (
                    <div key={db._id} className="border border-border rounded-lg bg-surface overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-hover" onClick={() => navigate(`/databases/${db._id}`)}>
                        <span className="text-xl">{dbType.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary truncate">{db.name}</span>
                            {db.backupEnabled && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">Backups ON</span>
                            )}
                          </div>
                          <div className="text-xs text-text-muted mt-0.5">
                            {dbType.label}
                            {db.host && ` • ${db.host}${db.port ? `:${db.port}` : ''}`}
                            {db.database && ` • ${db.database}`}
                          </div>
                        </div>
                        {db.accountId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${db.accountId?._id || ''}`); }}
                            className="text-xs px-2 py-1 rounded-md border border-border text-text-secondary hover:text-accent hover:border-accent hover:bg-accent/5 transition-colors"
                            title="View account details"
                          >
                            🔗 {db.accountId?.name}
                          </button>
                        )}
                        {db.backupEnabled && (
                          <span className="text-xs text-text-muted">Last backup: {timeSince(db.lastBackupAt)}</span>
                        )}
                        <span className="text-xs text-accent">→</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="w-[440px] shrink-0">
            <div className="sticky top-6">
              <div className="bg-surface rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-text-primary">Backup History</h2>
                  <span className="text-xs text-text-muted">{allBackups.length} records</span>
                </div>
                {backupsLoading ? (
                  <div className="text-xs text-text-muted py-6 text-center">Loading...</div>
                ) : allBackups.length === 0 ? (
                  <div className="text-xs text-text-muted py-6 text-center">No backup history yet</div>
                ) : (
                  <div className="space-y-1.5 max-h-[calc(100vh-180px)] overflow-y-auto">
                    {allBackups.map(b => (
                      <div
                        key={b._id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer text-xs"
                        onClick={() => {
                          const dbId = typeof b.databaseId === 'object' ? b.databaseId._id : b.databaseId;
                          navigate(`/databases/${dbId}`);
                        }}
                      >
                        <span className={`shrink-0 font-medium px-1.5 py-0.5 rounded ${
                          b.status === 'success' ? 'bg-success/20 text-success' :
                          b.status === 'failed' ? 'bg-error/20 text-error' :
                          'bg-warning/20 text-warning'
                        }`}>
                          {b.status === 'success' ? '✓' : b.status === 'failed' ? '✗' : '~'}
                        </span>
                        <span className="text-text-primary truncate flex-1">{getDbName(b.databaseId)}</span>
                        <span className="text-text-muted whitespace-nowrap">{formatSize(b.sizeBytes)}</span>
                        <span className="text-text-muted whitespace-nowrap">{new Date(b.completedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
