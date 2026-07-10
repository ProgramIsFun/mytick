import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Account, SecretRef as Secret } from '../types/account';
import { PROVIDERS } from '../constants/accounts';
import { inputCls } from '../constants/styles';
import PageHeader from '../components/PageHeader';
import ExpandableItem from '../components/ExpandableItem';
import DataState from '../components/DataState';
import FormActions from '../components/FormActions';
import Button from '../components/Button';
import TagPills from '../components/TagPills';
import { useLoadData } from '../hooks/useLoadData';
import { useDebouncedEffect } from '../hooks/useDebouncedEffect';

export default function AccountsPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', provider: 'custom', parentAccountId: '', url: '', username: '', notes: '' });
  const [search, setSearch] = useState('');
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [editCred, setEditCred] = useState<{ accountId: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => { api.getSecrets().then(setSecrets); }, []);

  const { data: accounts, loading, load } = useLoadData(() => api.getAccounts(search || undefined));
  useEffect(() => { load(); }, []);
  useDebouncedEffect(() => { load(); }, [search]);

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
      <PageHeader title="Accounts" backTo="/" count={accounts?.length ?? 0} countLabel="accounts" actions={<Button onClick={() => setCreating(!creating)}>+ New</Button>} />

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
              {(accounts ?? []).map((acc: Account) => <option key={acc.id} value={acc.id}>{PROVIDERS[acc.provider]?.emoji || '⚙️'} {acc.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className={inputCls} />
              <input placeholder="Username / Email" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className={inputCls} />
            </div>
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
            <FormActions submitLabel="Create" onCancel={() => setCreating(false)} />
          </form>
        )}

        <input placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} mb-4`} />

        <div className="space-y-2">
          <DataState loading={loading} items={accounts ?? []} loadingText="Loading accounts..." emptyMessage="No accounts yet">
            {(accounts ?? []).map((a: Account) => {
              const prov = PROVIDERS[a.provider] || PROVIDERS.custom;
              const isExpanded = expanded === a.id;
              return (
                <ExpandableItem key={a.id} expanded={isExpanded} onToggle={() => setExpanded(isExpanded ? null : a.id)} header={
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
                    {a.tags?.length > 0 && <TagPills tags={a.tags} />}
                    {a.url && <a href={a.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs px-2 py-1 rounded-md border border-border hover:bg-surface-hover">Open ↗</a>}
                  </>
                }>
                  <div className="space-y-2 text-sm">
                    {a.parentAccountId && (
                      <div>
                        <span className="text-text-muted">Parent Account:</span>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${a.parentAccountId}`); }} className="ml-2 text-xs px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20">View Parent ↑</button>
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
                            const isEditing = editCred?.accountId === a.id && editCred?.key === c.key;
                            const secretId = typeof c.secretId === 'object' ? c.secretId?.id : c.secretId;
                            const secret = secrets.find(s => s.id === secretId);
                            return (
                              <div key={c.key} className="flex items-center gap-1">
                                {isEditing ? (
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="Secret ID..." className="w-40 text-[11px] px-1.5 py-0.5 rounded border border-border bg-surface text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent" />
                                    <button onClick={async () => { try { await api.updateAccount(a.id, { credentials: a.credentials.map(cred => cred.key === c.key ? { ...cred, secretId: editValue || null } : cred) }); load(); setEditCred(null); } catch { alert('Failed'); } }} className="text-[11px] px-1.5 py-0.5 rounded bg-accent text-white hover:opacity-90">Save</button>
                                    <button onClick={() => setEditCred(null)} className="text-[11px] px-1.5 py-0.5 rounded border border-border hover:bg-surface-hover">Cancel</button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-light text-text-muted">{c.key}</span>
                                    {secret ? <button onClick={(e) => { e.stopPropagation(); navigate(`/secrets/${secret.id}`); }} className="text-[11px] px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20">{secret.name}</button>
                                      : secretId ? <span className="text-[11px] px-1.5 py-0.5 rounded text-warning font-mono">missing</span>
                                      : <span className="text-[11px] px-1.5 py-0.5 rounded text-text-muted">none</span>}
                                    <button onClick={(e) => { e.stopPropagation(); setEditCred({ accountId: a.id, key: c.key }); setEditValue(secretId || ''); }} className="text-[11px] px-1 py-0.5 rounded border border-border hover:bg-surface-hover text-text-muted hover:text-text-primary" title="Edit">✏️</button>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {(accounts ?? []).filter((sub: Account) => sub.parentAccountId === a.id).length > 0 && (
                      <div>
                        <span className="text-text-muted">Sub-accounts ({(accounts ?? []).filter((sub: Account) => sub.parentAccountId === a.id).length}):</span>
                        <div className="mt-1 space-y-1">
                          {(accounts ?? []).filter((sub: Account) => sub.parentAccountId === a.id).map((sub: Account) => (
                            <button key={sub.id} onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${sub.id}`); }} className="text-xs px-2 py-1 rounded bg-surface border border-border hover:bg-surface-hover flex items-center gap-1">
                              {PROVIDERS[sub.provider]?.emoji || '⚙️'} {sub.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <button onClick={() => handleDelete(a.id)} className="text-xs text-danger hover:underline">Delete account</button>
                    </div>
                  </div>
                </ExpandableItem>
              );
            })}
          </DataState>
        </div>
      </main>
    </div>
  );
}
