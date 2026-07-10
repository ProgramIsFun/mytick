import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { ContextEntry } from '../types/context';
import { inputCls } from '../constants/styles';
import PageHeader from '../components/PageHeader';
import ExpandableItem from '../components/ExpandableItem';
import DataState from '../components/DataState';
import FormActions from '../components/FormActions';
import { useLoadData } from '../hooks/useLoadData';

export default function ContextPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ key: '', value: '' });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const { data: entries, loading, load } = useLoadData(() => api.getContextEntries());
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
        count={entries?.length ?? 0}
        countLabel="entries"
        actions={<Button onClick={() => setCreating(!creating)}>+ New</Button>}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {creating && (
          <form onSubmit={handleCreate} className="border border-border rounded-lg p-4 bg-surface mb-4 space-y-3">
            <input placeholder="Key *" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} className={inputCls} />
            <textarea placeholder="Value" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} rows={4} className={inputCls} />
            <FormActions submitLabel="Save" onCancel={() => setCreating(false)} />
          </form>
        )}

        <DataState loading={loading} items={entries ?? []} loadingText="Loading context..." emptyMessage="No context entries yet">
          <div className="space-y-2">
            {(entries ?? []).map(e => {
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
                      <FormActions submitLabel="Save" onCancel={() => setEditingKey(null)} />
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
          </div>
        </DataState>
      </main>
    </div>
  );
}

function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors" {...props}>{children}</button>;
}
