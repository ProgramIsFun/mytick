import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

interface DescriptionVersion { description: string; savedAt: string; }
interface Task { _id: string; title: string; description: string; status: string; visibility: string; groupIds: string[]; shareToken: string; userId: string; descriptionHistory: DescriptionVersion[]; blockedBy: string[]; createdAt: string; }
interface BlockerTask { _id: string; title: string; status: string; }

const inputCls = "w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-warning/15 text-warning' },
  in_progress: { label: 'In Progress', cls: 'bg-accent/15 text-accent' },
  on_hold: { label: 'On Hold', cls: 'bg-purple/15 text-purple' },
  done: { label: 'Done', cls: 'bg-success/15 text-success' },
  abandoned: { label: 'Abandoned', cls: 'bg-gray/15 text-gray' },
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [blockers, setBlockers] = useState<BlockerTask[]>([]);
  const [blocking, setBlocking] = useState<BlockerTask[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getTask(id).then(setTask).catch((err: any) => setError(err.message));
    api.getBlocking(id).then(setBlocking).catch(() => setBlocking([]));
  }, [id]);

  useEffect(() => {
    if (!task?.blockedBy?.length) { setBlockers([]); return; }
    Promise.all(task.blockedBy.map(bid => api.getTask(bid).catch(() => null)))
      .then(results => setBlockers(results.filter(Boolean) as BlockerTask[]));
  }, [task?.blockedBy]);

  if (error) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <p className="text-danger mb-4">{error}</p>
        <button onClick={() => navigate('/')} className="text-sm text-accent hover:underline">← Back to dashboard</button>
      </div>
    </div>
  );

  if (!task) return <div className="min-h-screen bg-surface flex items-center justify-center text-text-muted">Loading...</div>;

  const isOwner = task.userId === user?.id;
  const badge = STATUS_BADGE[task.status] || STATUS_BADGE.pending;

  const saveDescription = async () => {
    if (draft === task.description) { setEditing(false); return; }
    setTask(await api.updateTask(task._id, { description: draft })); setEditing(false);
  };

  const saveTitle = async () => {
    if (!titleDraft.trim() || titleDraft === task.title) { setEditingTitle(false); return; }
    setTask(await api.updateTask(task._id, { title: titleDraft.trim() })); setEditingTitle(false);
  };

  const addSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    const sub = await api.createTask({ title: subtaskTitle.trim(), blockedBy: [] });
    setTask(await api.updateTask(task._id, { blockedBy: [...(task.blockedBy || []), sub._id] }));
    setSubtaskTitle('');
  };

  const removeBlocker = async (blockerId: string) => {
    setTask(await api.updateTask(task._id, { blockedBy: task.blockedBy.filter(i => i !== blockerId) }));
  };

  const visIcon = { private: '🔒 Private', group: '👥 Group', public: '🌐 Public' }[task.visibility] || '';

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-sm text-text-muted hover:text-text-primary transition-colors">← Back</button>
          <span className="text-xs text-text-muted font-mono">{task._id.slice(0, 8)}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Title */}
        {editingTitle ? (
          <div className="flex gap-2 items-center mb-4">
            <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
              autoFocus className="flex-1 text-2xl font-bold px-2 py-1 rounded border border-border bg-surface" />
            <button onClick={saveTitle} className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover">Save</button>
            <button onClick={() => setEditingTitle(false)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-hover">Cancel</button>
          </div>
        ) : (
          <h1 className={`text-2xl font-bold mb-1 ${task.status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'}`}>
            {task.title}
            {isOwner && <button onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }} className="ml-2 text-sm text-text-muted hover:text-text-primary">✏️</button>}
          </h1>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 mb-6">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
          <span className="text-xs text-text-muted">{visIcon}</span>
          <span className="text-xs text-text-muted">Created {new Date(task.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="grid gap-6">
          {/* Blocked by */}
          {(blockers.length > 0 || isOwner) && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Blocked by</h3>
              {blockers.map(b => (
                <div key={b._id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span>{b.status === 'done' ? '✅' : '🔴'}</span>
                  <a href={`/tasks/${b._id}`} onClick={e => { e.preventDefault(); navigate(`/tasks/${b._id}`); }}
                    className={`flex-1 text-accent hover:underline ${b.status === 'done' ? 'line-through' : ''}`}>{b.title}</a>
                  {isOwner && <button onClick={() => removeBlocker(b._id)} className="text-xs text-danger hover:underline">✕</button>}
                </div>
              ))}
              {blockers.length === 0 && <p className="text-xs text-text-muted">None</p>}
              {isOwner && (
                <form onSubmit={e => { e.preventDefault(); addSubtask(); }} className="flex gap-2 mt-3">
                  <input placeholder="Add a subtask..." value={subtaskTitle} onChange={e => setSubtaskTitle(e.target.value)} className={`flex-1 ${inputCls}`} />
                  <button type="submit" className="px-3 py-2 text-sm rounded-md bg-accent text-white hover:bg-accent-hover">+ Add</button>
                </form>
              )}
            </div>
          )}

          {/* Blocking */}
          {blocking.length > 0 && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Blocking</h3>
              {blocking.map(b => (
                <div key={b._id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span>{b.status === 'done' ? '✅' : '⏳'}</span>
                  <a href={`/tasks/${b._id}`} onClick={e => { e.preventDefault(); navigate(`/tasks/${b._id}`); }}
                    className={`text-accent hover:underline ${b.status === 'done' ? 'line-through' : ''}`}>{b.title}</a>
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="border border-border rounded-lg p-4 bg-surface">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide">Description</h3>
              {isOwner && !editing && <button onClick={() => { setDraft(task.description); setEditing(true); }} className="text-xs text-accent hover:underline">Edit</button>}
            </div>
            {editing ? (
              <div>
                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4} className={inputCls} />
                <div className="flex gap-2 mt-2">
                  <button onClick={saveDescription} className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover">Save</button>
                  <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-hover">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{task.description || <em className="text-text-muted">No description</em>}</p>
            )}
          </div>

          {/* History */}
          {task.descriptionHistory?.length > 0 && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Description History</h3>
              <div className="space-y-2">
                {task.descriptionHistory.map((v, i) => (
                  <div key={i} className="p-3 bg-surface-secondary rounded-md">
                    <div className="text-xs text-text-muted mb-1">{new Date(v.savedAt).toLocaleString()}</div>
                    <div className="text-sm text-text-secondary whitespace-pre-wrap">{v.description || <em className="text-text-muted">(empty)</em>}</div>
                    {isOwner && <button onClick={() => api.rollbackDescription(task._id, i).then(setTask)} className="text-xs text-accent hover:underline mt-1">↩ Rollback</button>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
