import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';

interface Account { _id: string; name: string; provider: string; }
interface Project { _id: string; title: string; }
interface Domain {
  _id: string; name: string; expiryDate: string | null; autoRenew: boolean;
  nameservers: string[]; sslProvider: string; notes: string; tags: string[];
  registrarAccountId: Account | null; dnsAccountId: Account | null;
  projectId: Project | null;
}

const inputCls = "w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40";

export default function DomainsPage() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', registrarAccountId: '', dnsAccountId: '', expiryDate: '', autoRenew: false, nameservers: '', sslProvider: '', notes: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getDomains(search || undefined).then(setDomains).finally(() => setLoading(false));
    api.getAccounts().then(setAccounts);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  const daysUntilExpiry = (date: string) => {
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
    return days;
  };

  const expiryBadge = (date: string | null) => {
    if (!date) return null;
    const days = daysUntilExpiry(date);
    if (days < 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-danger/15 text-danger font-medium">Expired</span>;
    if (days < 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">{days}d left</span>;
    return <span className="text-xs text-text-muted">{new Date(date).toLocaleDateString()}</span>;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    await api.createDomain({
      name: form.name,
      registrarAccountId: form.registrarAccountId || null,
      dnsAccountId: form.dnsAccountId || null,
      expiryDate: form.expiryDate || null,
      autoRenew: form.autoRenew,
      nameservers: form.nameservers ? form.nameservers.split(',').map(s => s.trim()) : [],
      sslProvider: form.sslProvider,
      notes: form.notes,
    });
    setForm({ name: '', registrarAccountId: '', dnsAccountId: '', expiryDate: '', autoRenew: false, nameservers: '', sslProvider: '', notes: '' });
    setCreating(false);
    load();
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-sm text-text-muted hover:text-text-primary">← Back</button>
          <h1 className="text-lg font-semibold text-text-primary">Domains</h1>
          <span className="text-xs text-text-muted">{domains.length} domains</span>
          <div className="flex-1" />
          <button onClick={() => setCreating(!creating)} className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover">+ New</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {creating && (
          <form onSubmit={handleCreate} className="border border-border rounded-lg p-4 bg-surface mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Domain name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
              <input type="date" placeholder="Expiry date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={form.registrarAccountId} onChange={e => setForm({ ...form, registrarAccountId: e.target.value })} className={inputCls}>
                <option value="">Registrar account...</option>
                {accounts.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
              <select value={form.dnsAccountId} onChange={e => setForm({ ...form, dnsAccountId: e.target.value })} className={inputCls}>
                <option value="">DNS account...</option>
                {accounts.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
            <input placeholder="Nameservers (comma separated)" value={form.nameservers} onChange={e => setForm({ ...form, nameservers: e.target.value })} className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="SSL provider" value={form.sslProvider} onChange={e => setForm({ ...form, sslProvider: e.target.value })} className={inputCls} />
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={form.autoRenew} onChange={e => setForm({ ...form, autoRenew: e.target.checked })} className="accent-accent" />
                Auto-renew
              </label>
            </div>
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover">Create</button>
              <button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-hover">Cancel</button>
            </div>
          </form>
        )}

        <input placeholder="Search domains..." value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} mb-4`} />

        <div className="space-y-2">
          {domains.map(d => {
            const isExpanded = expanded === d._id;
            return (
              <div key={d._id} className="border border-border rounded-lg bg-surface overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-hover" onClick={() => setExpanded(isExpanded ? null : d._id)}>
                  <span className="text-xl">🌐</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary">{d.name}</div>
                    <div className="text-xs text-text-muted">
                      {d.registrarAccountId && <span>via {(d.registrarAccountId as Account).name}</span>}
                      {d.autoRenew && <span className="ml-2">· 🔄 auto-renew</span>}
                    </div>
                  </div>
                  {expiryBadge(d.expiryDate)}
                  <span className="text-xs text-text-muted">{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div className="border-t border-border-light px-4 py-3 bg-surface-secondary space-y-2 text-sm">
                    {d.projectId && (
                      <div>
                        <span className="text-text-muted">Project:</span> 
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${(d.projectId as Project)._id}`); }}
                          className="ml-2 text-xs px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20"
                        >
                          {(d.projectId as Project).title} →
                        </button>
                      </div>
                    )}
                    {d.registrarAccountId && (
                      <div>
                        <span className="text-text-muted">Registrar:</span> 
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/accounts?highlight=${(d.registrarAccountId as Account)._id}`); }}
                          className="ml-2 text-xs px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20"
                        >
                          {(d.registrarAccountId as Account).name} →
                        </button>
                      </div>
                    )}
                    {d.dnsAccountId && (
                      <div>
                        <span className="text-text-muted">DNS:</span> 
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/accounts?highlight=${(d.dnsAccountId as Account)._id}`); }}
                          className="ml-2 text-xs px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20"
                        >
                          {(d.dnsAccountId as Account).name} →
                        </button>
                      </div>
                    )}
                    {d.nameservers.length > 0 && <div><span className="text-text-muted">Nameservers:</span> <span className="font-mono text-xs text-text-secondary">{d.nameservers.join(', ')}</span></div>}
                    {d.sslProvider && <div><span className="text-text-muted">SSL:</span> <span className="text-text-primary">{d.sslProvider}</span></div>}
                    {d.expiryDate && <div><span className="text-text-muted">Expires:</span> <span className="text-text-primary">{new Date(d.expiryDate).toLocaleDateString()}</span></div>}
                    {d.notes && <div><span className="text-text-muted">Notes:</span> <span className="text-text-secondary whitespace-pre-wrap">{d.notes}</span></div>}
                    <div className="pt-2">
                      <button onClick={() => { api.deleteDomain(d._id).then(load); }} className="text-xs text-danger hover:underline">Delete domain</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {loading ? <Spinner text="Loading domains..." /> : domains.length === 0 ? <div className="text-center py-12 text-text-muted text-sm">No domains yet</div> : null}
        </div>
      </main>
    </div>
  );
}
