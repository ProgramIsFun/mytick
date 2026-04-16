import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface Account {
  _id: string;
  name: string;
  provider: string;
  vaultId: string;
}

interface Service {
  accountId: Account | string;
  role: string;
  mappings: { target: string; envVar: string; vaultField: string }[];
}

interface Project {
  _id: string;
  name: string;
  description: string;
  repoUrl: string;
  localPath: string;
  services: Service[];
  members: { userId: string; role: string }[];
}

const PROVIDER_EMOJI: Record<string, string> = {
  mongodb_atlas: '🍃', firebase: '🔥', render: '🚀', aws: '☁️',
  stripe: '💳', github: '🐙', custom: '⚙️',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<'projects' | 'accounts'>('projects');
  const navigate = useNavigate();

  useEffect(() => {
    api.getProjects().then(setProjects);
    api.getAccounts().then(setAccounts);
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24 }}>Project Management</h1>
        <button onClick={() => navigate('/')} style={{ padding: '6px 12px' }}>← Dashboard</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab('projects')} style={{ padding: '8px 16px', fontWeight: tab === 'projects' ? 'bold' : 'normal', borderBottom: tab === 'projects' ? '2px solid var(--link)' : 'none' }}>
          Projects ({projects.length})
        </button>
        <button onClick={() => setTab('accounts')} style={{ padding: '8px 16px', fontWeight: tab === 'accounts' ? 'bold' : 'normal', borderBottom: tab === 'accounts' ? '2px solid var(--link)' : 'none' }}>
          Accounts ({accounts.length})
        </button>
      </div>

      {tab === 'projects' && (
        <div>
          {projects.map(p => (
            <div key={p._id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 12, background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 18, margin: 0 }}>{p.name}</h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.members.length} members</span>
              </div>
              {p.description && <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '8px 0' }}>{p.description}</p>}
              {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{p.repoUrl}</a>}
              {p.services.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Services:</div>
                  {p.services.map((s, i) => {
                    const acc = typeof s.accountId === 'object' ? s.accountId : accounts.find(a => a._id === s.accountId);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                        <span>{acc ? PROVIDER_EMOJI[acc.provider] || '⚙️' : '❓'}</span>
                        <span style={{ fontWeight: 500 }}>{acc?.name || 'Unknown'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>— {s.role}</span>
                        {s.mappings.length > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({s.mappings.length} env vars)</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {projects.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No projects yet</p>}
        </div>
      )}

      {tab === 'accounts' && (
        <div>
          {accounts.map(a => (
            <div key={a._id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 12, background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{PROVIDER_EMOJI[a.provider] || '⚙️'}</span>
                <div>
                  <div style={{ fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {a.provider} {a.vaultId ? `· vault: ${a.vaultId.slice(0, 8)}...` : '· no vault linked'}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {accounts.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No accounts yet</p>}
        </div>
      )}
    </div>
  );
}
