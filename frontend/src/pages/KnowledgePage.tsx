import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import type { KnowledgeEntry } from '../types/knowledge';
import { inputCls } from '../constants/styles';
import PageHeader from '../components/PageHeader';
import ExpandableItem from '../components/ExpandableItem';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formContent, setFormContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    api.getKnowledge(search ? { q: search } : undefined)
      .then(res => setEntries(res.items))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [search]);

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
        count={entries.length}
        countLabel="entries"
        actions={<Button onClick={() => setCreating(!creating)}>+ New</Button>}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {creating && (
          <form onSubmit={handleCreate} className="border border-border rounded-lg p-4 bg-surface mb-4 space-y-3">
            <textarea
              placeholder="What do you know?"
              value={formContent}
              onChange={e => setFormContent(e.target.value)}
              rows={4}
              className={inputCls}
            />
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button variant="secondary" type="button" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </form>
        )}

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search knowledge..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={inputCls}
          />
        </div>

        {loading ? <Spinner text="Loading knowledge..." /> : (
          <div className="space-y-2">
            {entries.map(e => {
              const isExpanded = expanded === e._id;
              const isEditing = editingId === e._id;
              return (
                <ExpandableItem
                  key={e._id}
                  expanded={isExpanded}
                  onToggle={() => setExpanded(isExpanded ? null : e._id)}
                  header={
                    <span className="text-sm text-text-secondary truncate">
                      {e.content.slice(0, 80)}{e.content.length > 80 ? '...' : ''}
                    </span>
                  }
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea value={editContent} onChange={ev => setEditContent(ev.target.value)} rows={8} className={inputCls} />
                      <div className="flex gap-2">
                        <Button onClick={() => handleSave(e._id)}>Save</Button>
                        <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <pre className="text-sm text-text-secondary whitespace-pre-wrap break-words">{e.content}</pre>
                      <div className="flex gap-3 mt-3">
                        <button onClick={() => { setEditingId(e._id); setEditContent(e.content); }} className="text-xs text-accent hover:underline">Edit</button>
                        <button onClick={() => handleDelete(e._id)} className="text-xs text-danger hover:underline">Delete</button>
                      </div>
                    </>
                  )}
                </ExpandableItem>
              );
            })}
            {entries.length === 0 && <EmptyState message="No knowledge entries yet" />}
          </div>
        )}
      </main>
    </div>
  );
}
