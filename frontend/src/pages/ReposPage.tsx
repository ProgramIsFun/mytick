import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Repo } from '../types/repo';
import { inputCls } from '../constants/styles';
import PageHeader from '../components/PageHeader';
import ExpandableItem from '../components/ExpandableItem';
import DataState from '../components/DataState';
import FormActions from '../components/FormActions';
import Button from '../components/Button';
import { useLoadData } from '../hooks/useLoadData';

export default function ReposPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState('');

  const { data: repos, loading, load } = useLoadData(() => api.getRepos());
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    await api.createRepo(url);
    setUrl('');
    setCreating(false);
    load();
  };

  const extractRepoName = (repoUrl: string) => {
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    return match ? match[1] : repoUrl;
  };

  return (
    <div className="min-h-screen bg-surface">
      <PageHeader title="Repos" backTo="/" count={repos?.length ?? 0} countLabel="repos" actions={<Button onClick={() => setCreating(!creating)}>+ New</Button>} />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {creating && (
          <form onSubmit={handleCreate} className="border border-border rounded-lg p-4 bg-surface mb-4 space-y-3">
            <input placeholder="Repository URL (e.g. https://github.com/user/repo)" value={url} onChange={e => setUrl(e.target.value)} className={inputCls} />
            <FormActions submitLabel="Create" onCancel={() => setCreating(false)} />
          </form>
        )}

        <div className="space-y-2">
          <DataState loading={loading} items={repos ?? []} loadingText="Loading repos..." emptyMessage="No repos yet">
            {(repos ?? []).map((r: Repo) => {
              const isExpanded = expanded === r.id;
              return (
                <ExpandableItem key={r.id} expanded={isExpanded} onToggle={() => setExpanded(isExpanded ? null : r.id)} header={
                  <>
                    <span className="text-xl">📦</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary">{extractRepoName(r.url)}</div>
                      <div className="text-xs text-text-muted truncate">{r.url}</div>
                    </div>
                  </>
                }>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/repos/${r.id}`)} className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20">View details</button>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20">Open on GitHub</a>
                    </div>
                    <div className="pt-2">
                      <button onClick={() => { api.deleteRepo(r.id).then(load); }} className="text-xs text-danger hover:underline">Delete repo</button>
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
