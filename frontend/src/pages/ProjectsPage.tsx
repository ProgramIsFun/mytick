import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface Account { _id: string; name: string; provider: string; credentials: { vaultId: string; key: string }[]; }
interface Service { accountId: Account | string; role: string; mappings: { target: string; envVar: string; vaultField: string }[]; }
interface Project { _id: string; name: string; description: string; repoUrl: string; localPath: string; services: Service[]; members: { userId: string; role: string }[]; }

const PROVIDER: Record<string, { emoji: string; label: string }> = {
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

type Tab = 'projects' | 'accounts';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<Tab>('projects');
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => { api.getProjects().then(setProjects); api.getAccounts().then(setAccounts); }, []);

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-sm text-text-muted hover:text-text-primary transition-colors">← Back</button>
            <h1 className="text-lg font-semibold text-text-primary">Projects</h1>
            <nav className="flex gap-1">
              {([['projects', '📁', 'Projects'], ['accounts', '🔑', 'Accounts']] as [Tab, string, string][]).map(([key, icon, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tab === key ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'}`}>
                  {icon} {label} ({key === 'projects' ? projects.length : accounts.length})
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {tab === 'projects' && (
          <div className="space-y-3">
            {projects.map(p => (
              <div key={p._id} className="border border-border rounded-lg p-5 bg-surface hover:border-border transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">{p.name}</h2>
                    {p.description && <p className="text-sm text-text-secondary mt-1">{p.description}</p>}
                  </div>
                  {p.members.length > 0 && (
                    <span className="text-xs text-text-muted bg-surface-secondary px-2 py-1 rounded-full">{p.members.length} members</span>
                  )}
                </div>

                {p.repoUrl && (
                  <a href={p.repoUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline mt-2 inline-block">{p.repoUrl}</a>
                )}

                {p.services.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-medium text-text-muted uppercase tracking-wide">Services</div>
                    {p.services.map((s, i) => {
                      const acc = typeof s.accountId === 'object' ? s.accountId : accounts.find(a => a._id === s.accountId);
                      const prov = PROVIDER[acc?.provider || 'custom'] || PROVIDER.custom;
                      return (
                        <div key={i} className="text-sm py-1.5 px-3 rounded-md bg-surface-secondary">
                          <div className="flex items-center gap-3">
                            <span>{prov.emoji}</span>
                            <span className="font-medium text-text-primary">{acc?.name || 'Unknown'}</span>
                            <span className="text-text-muted">—</span>
                            <span className="text-text-secondary">{s.role}</span>
                            {s.mappings.length > 0 && (
                              <span className="ml-auto text-xs text-text-muted">{s.mappings.length} env var{s.mappings.length !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                          {s.mappings.length > 0 && (
                            <div className="mt-1.5 ml-7 flex flex-wrap gap-1.5">
                              {s.mappings.map((m, j) => (
                                <span key={j} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-light text-text-muted">{m.envVar}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {projects.length === 0 && <div className="text-center py-12 text-text-muted text-sm">No projects yet</div>}
          </div>
        )}

        {tab === 'accounts' && (
          <div className="space-y-3">
            {accounts.map(a => {
              const prov = PROVIDER[a.provider] || PROVIDER.custom;
              const expanded = expandedAccount === a._id;
              const usedBy = projects.filter(p => p.services.some(s => {
                const aid = typeof s.accountId === 'object' ? (s.accountId as Account)._id : s.accountId;
                return aid === a._id;
              }));
              return (
                <div key={a._id} className="border border-border rounded-lg bg-surface overflow-hidden">
                  <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-surface-hover transition-colors" onClick={() => setExpandedAccount(expanded ? null : a._id)}>
                    <span className="text-2xl">{prov.emoji}</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-text-primary">{a.name}</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {prov.label}
                        {a.credentials.length > 0 ? <span className="ml-2">· 🔐 {a.credentials.length} key{a.credentials.length !== 1 ? 's' : ''}</span> : <span className="ml-2 text-warning">· ⚠️ no keys</span>}
                      </div>
                    </div>
                    <span className="text-xs text-text-muted">{expanded ? '▲' : '▼'}</span>
                  </div>
                  {expanded && (
                    <div className="border-t border-border-light px-4 py-3 bg-surface-secondary space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-text-muted">Provider</span>
                          <div className="text-text-primary font-medium mt-0.5">{prov.label}</div>
                        </div>
                        <div>
                          <span className="text-text-muted">Used by</span>
                          <div className="text-text-primary mt-0.5">{usedBy.length ? usedBy.map(p => p.name).join(', ') : 'No projects'}</div>
                        </div>
                      </div>
                      {a.credentials.length > 0 && (
                        <div>
                          <span className="text-xs text-text-muted">Credentials</span>
                          <div className="space-y-1 mt-1">
                            {a.credentials.map((c, j) => (
                              <div key={j} className="flex items-center gap-2">
                                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-light text-text-muted">{c.key}</span>
                                <span className="text-[10px] text-text-muted">••••••••</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-text-muted mt-2 italic">🔒 Values stored in your password manager. Local vault bridge coming soon.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {accounts.length === 0 && <div className="text-center py-12 text-text-muted text-sm">No accounts yet</div>}
          </div>
        )}
      </main>
    </div>
  );
}
