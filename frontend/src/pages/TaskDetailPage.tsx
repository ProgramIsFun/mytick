import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { PageSpinner } from '../components/Spinner';

interface DescriptionVersion { description: string; savedAt: string; }
interface Task { _id: string; title: string; description: string; status: string; visibility: string; groupIds: string[]; shareToken: string; userId: string; descriptionHistory: DescriptionVersion[]; blockedBy: string[]; createdAt: string; type?: string; tags?: string[]; metadata?: { projectType?: string; repoUrl?: string; localPath?: string; environments?: string[]; services?: { accountId: string; role: string; env?: string; mappings?: { target: string; envVar: string; vaultId: string }[] }[]; members?: { userId: string; role: string }[] } | null; }
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
  const [tagInput, setTagInput] = useState('');
  const [domains, setDomains] = useState<{ _id: string; name: string; expiryDate: string | null }[]>([]);
  const [subtasks, setSubtasks] = useState<BlockerTask[]>([]);

  useEffect(() => {
    if (!id) return;
    api.getTask(id).then(setTask).catch((err: any) => setError(err.message));
    api.getBlocking(id).then(setBlocking).catch(() => setBlocking([]));
    api.getSubtasks(id).then(setSubtasks).catch(() => setSubtasks([]));
    api.getDomains(undefined, undefined, id).then(setDomains).catch(() => setDomains([]));
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

  if (!task) return <PageSpinner />;

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
    await api.createTask({ title: subtaskTitle.trim(), parentId: task._id });
    setSubtasks(await api.getSubtasks(task._id));
    setSubtaskTitle('');
  };

  const removeBlocker = async (blockerId: string) => {
    setTask(await api.updateTask(task._id, { blockedBy: task.blockedBy.filter(i => i !== blockerId) }));
  };

  const addTag = async () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || task.tags?.includes(t)) { setTagInput(''); return; }
    setTask(await api.updateTask(task._id, { tags: [...(task.tags || []), t] }));
    setTagInput('');
  };

  const removeTag = async (tag: string) => {
    setTask(await api.updateTask(task._id, { tags: (task.tags || []).filter(t => t !== tag) }));
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

        {/* Tags */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {(task.tags || []).map(t => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent flex items-center gap-1">
              {t}
              {isOwner && <button onClick={() => removeTag(t)} className="hover:text-danger">×</button>}
            </span>
          ))}
          {isOwner && (
            <form onSubmit={e => { e.preventDefault(); addTag(); }} className="inline-flex">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="+ tag"
                className="text-xs px-2 py-0.5 w-20 rounded-full border border-border-light bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:w-32 transition-all"
              />
            </form>
          )}
        </div>

        <div className="grid gap-6">
          {/* Project metadata */}
          {task.type === 'project' && task.metadata && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">📁 Project Details</h3>
              <div className="space-y-3 text-sm">
                {task.metadata.repoUrl && (
                  <div><span className="text-text-muted">Repo:</span> <a href={task.metadata.repoUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{task.metadata.repoUrl}</a></div>
                )}
                {task.metadata.localPath && (
                  <div><span className="text-text-muted">Local:</span> <span className="font-mono text-xs text-text-secondary">{task.metadata.localPath}</span></div>
                )}
                {task.metadata.environments && task.metadata.environments.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Envs:</span>
                    {task.metadata.environments.map(e => (
                      <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-surface-secondary border border-border-light text-text-secondary">{e}</span>
                    ))}
                  </div>
                )}
                {task.metadata.services && task.metadata.services.length > 0 && (
                  <div>
                    <div className="text-text-muted mb-2">Services:</div>
                    {task.metadata.services.map((s, i) => (
                      <div key={i} className="ml-2 mb-2 p-2 rounded bg-surface-secondary">
                        <div className="text-text-primary font-medium">{s.role}{s.env ? ` (${s.env})` : ''}</div>
                        {s.mappings && s.mappings.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {s.mappings.map((m, j) => (
                              <span key={j} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-light text-text-muted">{m.envVar}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Domains */}
          {domains.length > 0 && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">🌐 Domains</h3>
              {domains.map(d => (
                <div key={d._id} className="flex items-center gap-2 py-1.5 text-sm">
                  <a href={`https://${d.name}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">{d.name}</a>
                  {d.expiryDate && <span className="text-xs text-text-muted">expires {new Date(d.expiryDate).toLocaleDateString()}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Subtasks */}
          {(subtasks.length > 0 || isOwner) && (
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Subtasks</h3>
              {subtasks.map(s => (
                <div key={s._id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span>{s.status === 'done' ? '✅' : '⬜'}</span>
                  <a href={`/tasks/${s._id}`} onClick={e => { e.preventDefault(); navigate(`/tasks/${s._id}`); }}
                    className={`flex-1 text-accent hover:underline ${s.status === 'done' ? 'line-through' : ''}`}>{s.title}</a>
                </div>
              ))}
              {subtasks.length === 0 && <p className="text-xs text-text-muted">None</p>}
              {isOwner && (
                <form onSubmit={e => { e.preventDefault(); addSubtask(); }} className="flex gap-2 mt-3">
                  <input placeholder="Add a subtask..." value={subtaskTitle} onChange={e => setSubtaskTitle(e.target.value)} className={`flex-1 ${inputCls}`} />
                  <button type="submit" className="px-3 py-2 text-sm rounded-md bg-accent text-white hover:bg-accent-hover">+ Add</button>
                </form>
              )}
            </div>
          )}

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
