import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';

interface Secret { _id: string; name: string; provider: string; }
interface Credential { vaultId: string; key: string; secretId?: Secret | string | null; }
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

const inputCls = "w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40";

export default function AccountsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', provider: 'custom', parentAccountId: '', url: '', username: '', notes: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); api.getAccounts(search || undefined).then(setAccounts).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);
  
  useEffect(() => {
    if (highlightId && accounts.length > 0) {
      setExpanded(highlightId);
      setTimeout(() => {
        document.getElementById(`account-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [highlightId, accounts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    await api.createAccount(form);
    setForm({ name: '', provider: 'custom', parentAccountId: '', url: '', username: '', notes: '' });
    setCreating(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await api.deleteAccount(id);
    load();
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-sm text-text-muted hover:text-text-primary">← Back</button>
          <h1 className="text-lg font-semibold text-text-primary">Accounts</h1>
          <span className="text-xs text-text-muted">{accounts.length} accounts</span>
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
              <input placeholder="Account name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
              <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className={inputCls}>
                {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>
            <select value={form.parentAccountId} onChange={e => setForm({ ...form, parentAccountId: e.target.value })} className={inputCls}>
              <option value="">No parent account (root)</option>
              {accounts.map(acc => <option key={acc._id} value={acc._id}>{PROVIDERS[acc.provider]?.emoji || '⚙️'} {acc.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className={inputCls} />
              <input placeholder="Username / Email" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className={inputCls} />
            </div>
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover">Create</button>
              <button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-hover">Cancel</button>
            </div>
          </form>
        )}

        <input
          placeholder="Search accounts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${inputCls} mb-4`}
        />

        <div className="space-y-2">
          {loading ? <Spinner text="Loading accounts..." /> : accounts.length === 0 ? <div className="text-center py-12 text-text-muted text-sm">No accounts yet</div> : accounts.map(a => {
            const prov = PROVIDERS[a.provider] || PROVIDERS.custom;
            const isExpanded = expanded === a._id;
            return (
              <div 
                key={a._id} 
                id={`account-${a._id}`}
                className={`border rounded-lg bg-surface overflow-hidden ${highlightId === a._id ? 'border-accent ring-2 ring-accent/20' : 'border-border'}`}
              >
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-hover" onClick={() => setExpanded(isExpanded ? null : a._id)}>
                  <span className="text-xl">{prov.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary">{a.name}</div>
                    <div className="text-xs text-text-muted">
                      {prov.label}
                      {a.username && <span className="ml-2">· {a.username}</span>}
                      {a.credentials.length > 0 && <span className="ml-2">· 🔐 {a.credentials.length} key{a.credentials.length !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  {a.tags?.length > 0 && (
                    <div className="flex gap-1">
                      {a.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{t}</span>)}
                    </div>
                  )}
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs px-2 py-1 rounded-md border border-border hover:bg-surface-hover">
                      Open ↗
                    </a>
                  )}
                  <span className="text-xs text-text-muted">{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div className="border-t border-border-light px-4 py-3 bg-surface-secondary space-y-2 text-sm">
                    {a.parentAccountId && (
                      <div>
                        <span className="text-text-muted">Parent Account:</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); navigate(`/accounts?highlight=${a.parentAccountId}`); window.location.reload(); }}
                          className="ml-2 text-xs px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20"
                        >
                          View Parent ↑
                        </button>
                      </div>
                    )}
                    {a.url && <div><span className="text-text-muted">URL:</span> <a href={a.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{a.url}</a></div>}
                    {a.username && <div><span className="text-text-muted">Username:</span> <span className="text-text-primary">{a.username}</span></div>}
                    {a.notes && <div><span className="text-text-muted">Notes:</span> <span className="text-text-secondary whitespace-pre-wrap">{a.notes}</span></div>}
                    {a.credentials.length > 0 && (
                      <div>
                        <span className="text-text-muted">Credentials:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {a.credentials.map((c, i) => (
                            <div key={i} className="flex items-center gap-1">
                              {c.secretId ? (
                                <>
                                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-light text-text-muted">
                                    {c.key}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const secretId = typeof c.secretId === 'object' ? c.secretId._id : c.secretId;
                                      navigate(`/secrets/${secretId}`);
                                    }}
                                    className="text-[11px] px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20"
                                    title="View secret"
                                  >
                                    🔐 Secret →
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span 
                                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-light text-text-muted cursor-pointer hover:bg-surface-hover" 
                                    title={`Copy vault ID: ${c.vaultId}`} 
                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(c.vaultId); }}
                                  >
                                    {c.key} 📋
                                  </span>
                                  <a
                                    href={`https://vault.bitwarden.com/#/vault?itemId=${c.vaultId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[11px] px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20"
                                    title="Open in Bitwarden web vault (Legacy)"
                                  >
                                    View ↗
                                  </a>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-text-muted mt-1 italic">🔒 Values in Bitwarden</p>
                      </div>
                    )}
                    {/* Sub-accounts */}
                    {accounts.filter(sub => sub.parentAccountId === a._id).length > 0 && (
                      <div>
                        <span className="text-text-muted">Sub-accounts ({accounts.filter(sub => sub.parentAccountId === a._id).length}):</span>
                        <div className="mt-1 space-y-1">
                          {accounts.filter(sub => sub.parentAccountId === a._id).map(sub => (
                            <button
                              key={sub._id}
                              onClick={(e) => { e.stopPropagation(); navigate(`/accounts?highlight=${sub._id}`); window.location.reload(); }}
                              className="text-xs px-2 py-1 rounded bg-surface border border-border hover:bg-surface-hover flex items-center gap-1"
                            >
                              {PROVIDERS[sub.provider]?.emoji || '⚙️'} {sub.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <button onClick={() => handleDelete(a._id)} className="text-xs text-danger hover:underline">Delete account</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
