import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { KnowledgeEntry } from '../types/knowledge';
import { inputCls } from '../constants/styles';
import PageHeader from '../components/PageHeader';
import ExpandableItem from '../components/ExpandableItem';
import DataState from '../components/DataState';
import FormActions from '../components/FormActions';
import { useLoadData } from '../hooks/useLoadData';
import { useDebouncedEffect } from '../hooks/useDebouncedEffect';

export default function KnowledgePage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formContent, setFormContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, load } = useLoadData(() =>
    api.getKnowledge(search ? { q: search } : undefined).then(res => res.items)
  );
  useEffect(() => { load(); }, []);
  useDebouncedEffect(() => { load(); }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;
    await api.createKnowledge({ content: formContent.trim() });
    setFormContent('');
    setCreating(false);
    load();
  };

  const handleSave = async (id: string) => {
    await api.updateKnowledge(id, { content: editContent });
    setEditingId(null);
    load();
  };

  const handleDelete = async (id: string) => {
    await api.deleteKnowledge(id);
    load();
  };

  return (
    <div className="min-h-screen bg-surface">
      <PageHeader
        title="Knowledge"
        backTo="/"
        count={data?.length ?? 0}
        countLabel="entries"
        actions={<Button onClick={() => setCreating(!creating)}>+ New</Button>}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {creating && (
          <form onSubmit={handleCreate} className="border border-border rounded-lg p-4 bg-surface mb-4 space-y-3">
            <textarea placeholder="What do you know?" value={formContent} onChange={e => setFormContent(e.target.value)} rows={4} className={inputCls} />
            <FormActions submitLabel="Save" onCancel={() => setCreating(false)} />
          </form>
        )}

        <div className="mb-4">
          <input type="text" placeholder="Search knowledge..." value={search} onChange={e => setSearch(e.target.value)} className={inputCls} />
        </div>

        <DataState loading={loading} items={data ?? []} loadingText="Loading knowledge..." emptyMessage="No knowledge entries yet">
          <div className="space-y-2">
            {(data ?? []).map(e => {
              const isExpanded = expanded === e.id;
              const isEditing = editingId === e.id;
              return (
                <ExpandableItem
                  key={e.id}
                  expanded={isExpanded}
                  onToggle={() => setExpanded(isExpanded ? null : e.id)}
                  header={<span className="text-sm text-text-secondary truncate">{e.content.slice(0, 80)}{e.content.length > 80 ? '...' : ''}</span>}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea value={editContent} onChange={ev => setEditContent(ev.target.value)} rows={8} className={inputCls} />
                      <FormActions submitLabel="Save" onCancel={() => setEditingId(null)} />
                    </div>
                  ) : (
                    <>
                      <pre className="text-sm text-text-secondary whitespace-pre-wrap break-words">{e.content}</pre>
                      <div className="flex gap-3 mt-3">
                        <button onClick={() => { setEditingId(e.id); setEditContent(e.content); }} className="text-xs text-accent hover:underline">Edit</button>
                        <button onClick={() => handleDelete(e.id)} className="text-xs text-danger hover:underline">Delete</button>
                      </div>
                    </>
                  )}
                </ExpandableItem>
              );
            })}
          </div>
        </DataState>
      </main>
    </div>
  );
}

function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors" {...props}>{children}</button>;
}
