import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';

interface ContextEntry { _id: string; key: string; value: string; }

const inputCls = "w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40";

export default function ContextPage() {
  const navigate = useNavigate();
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
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-sm text-text-muted hover:text-text-primary">← Back</button>
          <h1 className="text-lg font-semibold text-text-primary">Context</h1>
          <span className="text-xs text-text-muted">{entries.length} entries</span>
          <div className="flex-1" />
          <button onClick={() => setCreating(!creating)} className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover">+ New</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {creating && (
          <form onSubmit={handleCreate} className="border border-border rounded-lg p-4 bg-surface mb-4 space-y-3">
            <input placeholder="Key *" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} className={inputCls} />
            <textarea placeholder="Value" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} rows={4} className={inputCls} />
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover">Save</button>
              <button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-hover">Cancel</button>
            </div>
          </form>
        )}

        {loading ? <Spinner text="Loading context..." /> : (
          <div className="space-y-2">
            {entries.map(e => {
              const isExpanded = expanded === e.key;
              const isEditing = editingKey === e.key;
              return (
                <div key={e.key} className="border border-border rounded-lg bg-surface overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-hover" onClick={() => setExpanded(isExpanded ? null : e.key)}>
                    <span className="text-sm font-mono font-medium text-accent">{e.key}</span>
                    <span className="text-xs text-text-muted truncate flex-1">{e.value.slice(0, 80)}{e.value.length > 80 ? '...' : ''}</span>
                    <span className="text-xs text-text-muted">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-border-light px-4 py-3 bg-surface-secondary">
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea value={editValue} onChange={ev => setEditValue(ev.target.value)} rows={8} className={inputCls} />
                          <div className="flex gap-2">
                            <button onClick={() => handleSave(e.key)} className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover">Save</button>
                            <button onClick={() => setEditingKey(null)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-hover">Cancel</button>
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
                    </div>
                  )}
                </div>
              );
            })}
            {entries.length === 0 && <div className="text-center py-12 text-text-muted text-sm">No context entries yet</div>}
          </div>
        )}
      </main>
    </div>
  );
}
