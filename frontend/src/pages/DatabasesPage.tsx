import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';

interface SecretRef {
  provider: 'bitwarden' | '1password' | 'lastpass' | 'vault' | 'custom';
  itemId: string;
  field?: string;
}

interface Account { _id: string; name: string; provider: string; }
interface Database {
  _id: string; name: string; type: string; host: string; port: number | null;
  database: string; secretRef: SecretRef | null; backupEnabled: boolean;
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

const inputCls = "w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40";

export default function DatabasesPage() {
  const navigate = useNavigate();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'mongodb', host: '', port: '', database: '',
    secretProvider: 'bitwarden' as SecretRef['provider'], secretItemId: '', secretField: '',
    backupEnabled: false, backupRetentionDays: 30, backupFrequency: 'daily',
    accountId: '', notes: ''
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getDatabases(search || undefined).then(setDatabases).finally(() => setLoading(false));
    api.getAccounts().then(setAccounts);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.type) return;
    await api.createDatabase({
      name: form.name,
      type: form.type,
      host: form.host,
      port: form.port ? parseInt(form.port) : null,
      database: form.database,
      secretRef: form.secretItemId ? {
        provider: form.secretProvider,
        itemId: form.secretItemId,
        field: form.secretField || undefined,
      } : null,
      backupEnabled: form.backupEnabled,
      backupRetentionDays: form.backupRetentionDays,
      backupFrequency: form.backupFrequency,
      accountId: form.accountId || null,
      notes: form.notes,
    });
    setForm({
      name: '', type: 'mongodb', host: '', port: '', database: '',
      secretProvider: 'bitwarden', secretItemId: '', secretField: '',
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

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-sm text-text-muted hover:text-text-primary">← Back</button>
          <h1 className="text-lg font-semibold text-text-primary">Databases</h1>
          <span className="text-xs text-text-muted">{databases.length} databases</span>
          <div className="flex-1" />
          <button onClick={() => setCreating(!creating)} className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover">
            + New
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {creating && (
          <form onSubmit={handleCreate} className="border border-border rounded-lg p-4 bg-surface mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Database name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} required />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls}>
                {Object.entries(DB_TYPES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>
            <div className="border border-border rounded-lg p-3 bg-surface-secondary">
              <label className="text-xs font-medium text-text-muted block mb-2">Secret Manager (optional)</label>
              <div className="grid grid-cols-3 gap-2">
                <select value={form.secretProvider} onChange={e => setForm({ ...form, secretProvider: e.target.value as SecretRef['provider'] })} className={inputCls}>
                  <option value="bitwarden">🔐 Bitwarden</option>
                  <option value="1password">🔑 1Password</option>
                  <option value="lastpass">🔒 LastPass</option>
                  <option value="vault">🏦 Vault</option>
                  <option value="custom">⚙️ Custom</option>
                </select>
                <input placeholder="Item ID" value={form.secretItemId} onChange={e => setForm({ ...form, secretItemId: e.target.value })} className={inputCls} />
                <input placeholder="Field (optional)" value={form.secretField} onChange={e => setForm({ ...form, secretField: e.target.value })} className={inputCls} />
              </div>
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
              const isExpanded = expanded === db._id;
              
              return (
                <div key={db._id} className="border border-border rounded-lg bg-surface overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-hover" onClick={() => setExpanded(isExpanded ? null : db._id)}>
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
                        onClick={(e) => { e.stopPropagation(); navigate(`/accounts?highlight=${db.accountId._id}`); }}
                        className="text-xs px-2 py-1 rounded-md border border-border text-text-secondary hover:text-accent hover:border-accent hover:bg-accent/5 transition-colors"
                        title="View account details"
                      >
                        🔗 {db.accountId.name}
                      </button>
                    )}
                    {db.backupEnabled && (
                      <span className="text-xs text-text-muted">Last backup: {timeSince(db.lastBackupAt)}</span>
                    )}
                    <span className="text-xs text-text-muted">{isExpanded ? '▼' : '▶'}</span>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 bg-surface-secondary space-y-3">
                      {db.secretRef && (
                        <div>
                          <label className="text-xs font-medium text-text-muted block mb-1">Secret Reference</label>
                          <div className="flex items-center gap-2">
                            <div className="text-xs px-2 py-1 rounded bg-surface border border-border">
                              {db.secretRef.provider === 'bitwarden' && '🔐 Bitwarden'}
                              {db.secretRef.provider === '1password' && '🔑 1Password'}
                              {db.secretRef.provider === 'lastpass' && '🔒 LastPass'}
                              {db.secretRef.provider === 'vault' && '🏦 Vault'}
                              {db.secretRef.provider === 'custom' && '⚙️ Custom'}
                            </div>
                            <div className="text-xs text-text-primary font-mono bg-surface px-2 py-1.5 rounded border border-border flex-1 truncate">
                              {db.secretRef.itemId}{db.secretRef.field && ` → ${db.secretRef.field}`}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(db.secretRef!.itemId); }}
                              className="text-xs px-2 py-1.5 rounded-md border border-border text-text-secondary hover:bg-surface-hover"
                              title="Copy Item ID"
                            >
                              📋
                            </button>
                          </div>
                        </div>
                      )}
                      {db.notes && (
                        <div>
                          <label className="text-xs font-medium text-text-muted block mb-1">Notes</label>
                          <div className="text-xs text-text-secondary whitespace-pre-wrap">{db.notes}</div>
                        </div>
                      )}
                      {db.backupEnabled && (
                        <div className="flex items-center gap-4 text-xs text-text-muted">
                          <span>📅 {db.backupFrequency} backups</span>
                          <span>🗑️ Keep for {db.backupRetentionDays} days</span>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleBackup(db._id, db.backupEnabled); }}
                          className={`text-xs px-3 py-1.5 rounded-md border ${db.backupEnabled ? 'border-warning/30 text-warning hover:bg-warning/10' : 'border-success/30 text-success hover:bg-success/10'}`}
                        >
                          {db.backupEnabled ? 'Disable Backups' : 'Enable Backups'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(db._id); }}
                          className="text-xs px-3 py-1.5 rounded-md border border-danger/30 text-danger hover:bg-danger/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
