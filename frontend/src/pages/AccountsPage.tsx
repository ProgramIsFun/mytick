import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import type { Account, SecretRef as Secret } from '../types/account';
import { PROVIDERS } from '../constants/accounts';
import { inputCls } from '../constants/styles';
import PageHeader from '../components/PageHeader';
import ExpandableItem from '../components/ExpandableItem';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';

export default function AccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', provider: 'custom', parentAccountId: '', url: '', username: '', notes: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [editCred, setEditCred] = useState<{ accountId: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => { api.getSecrets().then(setSecrets); }, []);

  const load = () => { setLoading(true); api.getAccounts(search || undefined).then(setAccounts).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

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
      <PageHeader
        title="Accounts"
        backTo="/"
        count={accounts.length}
        countLabel="accounts"
        actions={
          <Button onClick={() => setCreating(!creating)}>+ New</Button>
        }
      />

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
              <Button type="submit">Create</Button>
              <Button variant="secondary" type="button" onClick={() => setCreating(false)}>Cancel</Button>
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
          {loading ? <Spinner text="Loading accounts..." /> : accounts.length === 0 ? <EmptyState message="No accounts yet" /> : accounts.map(a => {
            const prov = PROVIDERS[a.provider] || PROVIDERS.custom;
            const isExpanded = expanded === a._id;
            return (
              <ExpandableItem
                key={a._id}
                expanded={isExpanded}
                onToggle={() => setExpanded(isExpanded ? null : a._id)}
                header={
                  <>
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
                  </>
                }
              >
                <div className="space-y-2 text-sm">
                    {a.parentAccountId && (
                      <div>
                        <span className="text-text-muted">Parent Account:</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${a.parentAccountId}`); }}
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
                          {a.credentials.map((c) => {
                            const isEditing = editCred?.accountId === a._id && editCred?.key === c.key;
                            const secretId = typeof c.secretId === 'object' ? c.secretId?._id : c.secretId;
                            const secret = secrets.find(s => s._id === secretId);

                            return (
                              <div key={c.key} className="flex items-center gap-1">
                                {isEditing ? (
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={editValue}
                                      onChange={e => setEditValue(e.target.value)}
                                      placeholder="Secret ID..."
                                      className="w-40 text-[11px] px-1.5 py-0.5 rounded border border-border bg-surface text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                                    />
                                    <button
                                      onClick={async () => {
                                        try {
                                          await api.updateAccount(a._id, {
                                            credentials: a.credentials.map(cred =>
                                              cred.key === c.key ? { ...cred, secretId: editValue || null } : cred
                                            ),
                                          });
                                          load();
                                          setEditCred(null);
                                        } catch { alert('Failed'); }
                                      }}
                                      className="text-[11px] px-1.5 py-0.5 rounded bg-accent text-white hover:opacity-90"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditCred(null)}
                                      className="text-[11px] px-1.5 py-0.5 rounded border border-border hover:bg-surface-hover"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-light text-text-muted">
                                      {c.key}
                                    </span>
                                    {secret ? (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); navigate(`/secrets/${secret._id}`); }}
                                        className="text-[11px] px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20"
                                      >
                                        {secret.name}
                                      </button>
                                    ) : secretId ? (
                                      <span className="text-[11px] px-1.5 py-0.5 rounded text-warning font-mono">
                                        missing
                                      </span>
                                    ) : (
                                      <span className="text-[11px] px-1.5 py-0.5 rounded text-text-muted">
                                        none
                                      </span>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditCred({ accountId: a._id, key: c.key });
                                        setEditValue(secretId || '');
                                      }}
                                      className="text-[11px] px-1 py-0.5 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary"
                                      title="Edit"
                                    >
                                      ✏️
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
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
                              onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${sub._id}`); }}
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
              </ExpandableItem>
            );
          })}
        </div>
      </main>
    </div>
  );
}
