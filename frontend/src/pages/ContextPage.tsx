import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import type { ContextEntry } from '../types/context';
import { inputCls } from '../constants/styles';
import PageHeader from '../components/PageHeader';
import ExpandableItem from '../components/ExpandableItem';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';

export default function ContextPage() {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ key: '', value: '' });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const load = () => { setLoading(true); api.getContextEntries().then(setEntries).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.key.trim()) return;
    await api.setContext(form.key.trim(), form.value);
    setForm({ key: '', value: '' });
    setCreating(false);
    load();
  };

  const handleSave = async (key: string) => {
    await api.setContext(key, editValue);
    setEditingKey(null);
    load();
  };

  const handleDelete = async (key: string) => {
    await api.deleteContext(key);
    load();
  };

  return (
    <div className="min-h-screen bg-surface">
      <PageHeader
        title="Context"
        backTo="/"
        count={entries.length}
        countLabel="entries"
        actions={<Button onClick={() => setCreating(!creating)}>+ New</Button>}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {creating && (
          <form onSubmit={handleCreate} className="border border-border rounded-lg p-4 bg-surface mb-4 space-y-3">
            <input placeholder="Key *" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} className={inputCls} />
            <textarea placeholder="Value" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} rows={4} className={inputCls} />
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button variant="secondary" type="button" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {loading ? <Spinner text="Loading context..." /> : (
          <div className="space-y-2">
            {entries.map(e => {
              const isExpanded = expanded === e.key;
              const isEditing = editingKey === e.key;
              return (
                <ExpandableItem
                  key={e.key}
                  expanded={isExpanded}
                  onToggle={() => setExpanded(isExpanded ? null : e.key)}
                  header={
                    <>
                      <span className="text-sm font-mono font-medium text-accent">{e.key}</span>
                      <span className="text-xs text-text-muted truncate flex-1 ml-2">{e.value.slice(0, 80)}{e.value.length > 80 ? '...' : ''}</span>
                    </>
                  }
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea value={editValue} onChange={ev => setEditValue(ev.target.value)} rows={8} className={inputCls} />
                      <div className="flex gap-2">
                        <Button onClick={() => handleSave(e.key)}>Save</Button>
                        <Button variant="secondary" onClick={() => setEditingKey(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <pre className="text-sm text-text-secondary whitespace-pre-wrap break-words">{e.value}</pre>
                      <div className="flex gap-3 mt-3">
                        <button onClick={() => { setEditingKey(e.key); setEditValue(e.value); }} className="text-xs text-accent hover:underline">Edit</button>
                        <button onClick={() => handleDelete(e.key)} className="text-xs text-danger hover:underline">Delete</button>
                      </div>
                    </>
                  )}
                </ExpandableItem>
              );
            })}
            {entries.length === 0 && <EmptyState message="No context entries yet" />}
          </div>
        )}
      </main>
    </div>
  );
}
