import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import type { Domain, AccountRef as Account, ProjectRef as Project } from '../types/domain';
import { inputCls } from '../constants/styles';
import { expiryBadge } from '../utils/domain';
import PageHeader from '../components/PageHeader';
import ExpandableItem from '../components/ExpandableItem';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';

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
      <PageHeader
        title="Domains"
        backTo="/"
        count={domains.length}
        countLabel="domains"
        actions={<Button onClick={() => setCreating(!creating)}>+ New</Button>}
      />

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
              <Button type="submit">Create</Button>
              <Button variant="secondary" type="button" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </form>
        )}

        <input placeholder="Search domains..." value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} mb-4`} />

        <div className="space-y-2">
          {domains.map(d => {
            const isExpanded = expanded === d._id;
            return (
              <ExpandableItem
                key={d._id}
                expanded={isExpanded}
                onToggle={() => setExpanded(isExpanded ? null : d._id)}
                header={
                  <>
                    <span className="text-xl">🌐</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary">{d.name}</div>
                      <div className="text-xs text-text-muted">
                        {d.registrarAccountId && <span>via {(d.registrarAccountId as Account).name}</span>}
                        {d.autoRenew && <span className="ml-2">· 🔄 auto-renew</span>}
                      </div>
                    </div>
                    {expiryBadge(d.expiryDate)}
                  </>
                }
              >
                <div className="space-y-2 text-sm">
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
                          onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${(d.registrarAccountId as Account)._id}`); }}
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
                          onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${(d.dnsAccountId as Account)._id}`); }}
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
              </ExpandableItem>
            );
          })}
          {loading ? <Spinner text="Loading domains..." /> : domains.length === 0 ? <EmptyState message="No domains yet" /> : null}
        </div>
      </main>
    </div>
  );
}
