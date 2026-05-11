import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import type { Subscription, SubscriptionStats } from '../types/subscription';
import { BILLING_CYCLES, SUBSCRIPTION_STATUSES, SUBSCRIPTION_STATUS_COLORS, getCategoryIcon } from '../constants/subscriptions';
import { inputCls } from '../constants/styles';
import PageHeader from '../components/PageHeader';
import ExpandableItem from '../components/ExpandableItem';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function nextDateBadge(date: string | null, label: string) {
  if (!date) return null;
  const d = new Date(date);
  const now = Date.now();
  const diff = d.getTime() - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  let cls = 'text-green-500';
  if (days < 0) cls = 'text-red-400';
  else if (days <= 3) cls = 'text-yellow-400';
  else if (days <= 7) cls = 'text-orange-400';
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${cls} ${cls.includes('bg') ? '' : 'bg-current/10'}`}
      style={{ background: `${cls.replace('text-', '').replace('-400', '').replace('-500', '')}20` }}>
      {label}: {d.toLocaleDateString()}
    </span>
  );
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '', provider: '', amount: '', currency: 'USD', billingCycle: 'monthly',
    nextBillingDate: '', expiryDate: '', autoRenew: false, status: 'active',
    category: '', paymentMethod: '', url: '', notes: '', tags: '',
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getSubscriptions({ q: search || undefined, status: statusFilter || undefined }),
      api.getSubscriptionStats(),
    ]).then(([data, s]) => { setSubs(data); setStats(s); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.provider || !form.amount || !form.billingCycle) return;
    await api.createSubscription({
      name: form.name,
      provider: form.provider,
      amount: parseFloat(form.amount),
      currency: form.currency,
      billingCycle: form.billingCycle,
      nextBillingDate: form.nextBillingDate || null,
      expiryDate: form.expiryDate || null,
      autoRenew: form.autoRenew,
      status: form.status,
      category: form.category,
      paymentMethod: form.paymentMethod,
      url: form.url,
      notes: form.notes,
      tags: form.tags ? form.tags.split(',').map(s => s.trim()) : [],
    });
    setForm({ name: '', provider: '', amount: '', currency: 'USD', billingCycle: 'monthly', nextBillingDate: '', expiryDate: '', autoRenew: false, status: 'active', category: '', paymentMethod: '', url: '', notes: '', tags: '' });
    setCreating(false);
    load();
  };

  return (
    <div className="min-h-screen bg-surface">
      <PageHeader
        title="Subscriptions"
        backTo="/"
        count={subs.length}
        countLabel="subscriptions"
        actions={<Button onClick={() => setCreating(!creating)}>+ New</Button>}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {stats && stats.total > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-surface-secondary border border-border text-sm flex items-center gap-4">
            <span className="text-text-muted">Monthly spend:</span>
            <span className="text-lg font-semibold text-text-primary">{formatAmount(stats.totalMonthly, stats.currency)}</span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">{stats.total} active subscription{stats.total !== 1 ? 's' : ''}</span>
          </div>
        )}

        {creating && (
          <form onSubmit={handleCreate} className="border border-border rounded-lg p-4 bg-surface mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Subscription name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
              <input placeholder="Provider *" value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input type="number" step="0.01" placeholder="Amount *" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inputCls} />
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className={inputCls}>
                {['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'HKD'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={form.billingCycle} onChange={e => setForm({ ...form, billingCycle: e.target.value })} className={inputCls}>
                {Object.entries(BILLING_CYCLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" placeholder="Next billing date" value={form.nextBillingDate} onChange={e => setForm({ ...form, nextBillingDate: e.target.value })} className={inputCls} />
              <input type="date" placeholder="Expiry date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls} />
              <input placeholder="Payment method" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className={inputCls} />
            </div>
            <input placeholder="URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls}>
                {Object.entries(SUBSCRIPTION_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={form.autoRenew} onChange={e => setForm({ ...form, autoRenew: e.target.checked })} className="accent-accent" />
                Auto-renew
              </label>
            </div>
            <input placeholder="Tags (comma separated)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className={inputCls} />
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button variant="secondary" type="button" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </form>
        )}

        <div className="flex gap-2 mb-4">
          <input placeholder="Search subscriptions..." value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} flex-1`} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputCls} w-40`}>
            <option value="">All statuses</option>
            {Object.entries(SUBSCRIPTION_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {loading ? <Spinner text="Loading subscriptions..." /> : subs.length === 0 ? <EmptyState message="No subscriptions yet" /> : subs.map(s => {
            const isExpanded = expanded === s._id;
            return (
              <ExpandableItem
                key={s._id}
                expanded={isExpanded}
                onToggle={() => setExpanded(isExpanded ? null : s._id)}
                header={
                  <>
                    <span className="text-xl">{getCategoryIcon(s.category)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary">{s.name}</div>
                      <div className="text-xs text-text-muted">
                        {s.provider}
                        <span className="ml-2">{BILLING_CYCLES[s.billingCycle]}</span>
                        <span className="ml-2">· {formatAmount(s.amount, s.currency)}</span>
                      </div>
                    </div>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${SUBSCRIPTION_STATUS_COLORS[s.status]}`}>
                      {SUBSCRIPTION_STATUSES[s.status]}
                    </span>
                    {nextDateBadge(s.nextBillingDate, 'Billing')}
                  </>
                }
              >
                <div className="space-y-2 text-sm">
                  {s.nextBillingDate && <div><span className="text-text-muted">Next billing:</span> <span className="text-text-primary">{new Date(s.nextBillingDate).toLocaleDateString()}</span></div>}
                  {s.expiryDate && <div><span className="text-text-muted">Expires:</span> <span className="text-text-primary">{new Date(s.expiryDate).toLocaleDateString()}</span></div>}
                  <div><span className="text-text-muted">Amount:</span> <span className="text-text-primary">{formatAmount(s.amount, s.currency)} / {BILLING_CYCLES[s.billingCycle].toLowerCase()}</span></div>
                  {s.paymentMethod && <div><span className="text-text-muted">Payment:</span> <span className="text-text-primary">{s.paymentMethod}</span></div>}
                  {s.category && <div><span className="text-text-muted">Category:</span> <span className="text-text-primary">{s.category}</span></div>}
                  {s.url && <div><span className="text-text-muted">URL:</span> <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{s.url}</a></div>}
                  {s.notes && <div><span className="text-text-muted">Notes:</span> <span className="text-text-secondary whitespace-pre-wrap">{s.notes}</span></div>}
                  {s.tags.length > 0 && (
                    <div className="flex gap-1">
                      <span className="text-text-muted">Tags:</span>
                      {s.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{t}</span>)}
                    </div>
                  )}
                  <div className="pt-2">
                    <button onClick={() => { api.deleteSubscription(s._id).then(load); }} className="text-xs text-danger hover:underline">Delete subscription</button>
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
