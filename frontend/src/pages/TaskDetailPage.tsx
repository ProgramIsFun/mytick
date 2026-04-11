import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

interface DescriptionVersion {
  description: string;
  savedAt: string;
}

interface Task {
  _id: string;
  title: string;
  description: string;
  status: string;
  visibility: string;
  groupIds: string[];
  shareToken: string;
  userId: string;
  descriptionHistory: DescriptionVersion[];
  blockedBy: string[];
  createdAt: string;
}

interface BlockerTask {
  _id: string;
  title: string;
  status: string;
}

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

  if (error) return <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
    <p style={{ color: 'red' }}>{error}</p>
    <button onClick={() => navigate('/')}>← Back</button>
  </div>;

  if (!task) return <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>Loading...</div>;

  const isOwner = task.userId === user?.id;

  const saveDescription = async () => {
    if (draft === task.description) { setEditing(false); return; }
    const updated = await api.updateTask(task._id, { description: draft });
    setTask(updated);
    setEditing(false);
  };

  const saveTitle = async () => {
    if (!titleDraft.trim() || titleDraft === task.title) { setEditingTitle(false); return; }
    const updated = await api.updateTask(task._id, { title: titleDraft.trim() });
    setTask(updated);
    setEditingTitle(false);
  };

  const rollback = async (index: number) => {
    const updated = await api.rollbackDescription(task._id, index);
    setTask(updated);
  };

  const addSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    const sub = await api.createTask({ title: subtaskTitle.trim(), blockedBy: [] });
    const updated = await api.updateTask(task._id, { blockedBy: [...(task.blockedBy || []), sub._id] });
    setTask(updated);
    setSubtaskTitle('');
  };

  const removeBlocker = async (blockerId: string) => {
    const updated = await api.updateTask(task._id, { blockedBy: task.blockedBy.filter(id => id !== blockerId) });
    setTask(updated);
  };

  const visibilityLabel = { private: '🔒 Private', group: '👥 Group', public: '🌐 Public' }[task.visibility] || '';

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: 16 }}>← Back</button>
      {editingTitle ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }} autoFocus style={{ flex: 1, fontSize: 24, fontWeight: 'bold', padding: 4 }} />
          <button onClick={saveTitle}>Save</button>
          <button onClick={() => setEditingTitle(false)}>Cancel</button>
        </div>
      ) : (
        <h1 style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
          {task.title}
          {isOwner && <button onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }} style={{ marginLeft: 8, fontSize: 14, verticalAlign: 'middle' }}>✏️</button>}
        </h1>
      )}
      <p style={{ color: '#666', fontSize: 14 }}>ID: {task._id}</p>
      <p><strong>Status:</strong> {task.status}</p>
      <p><strong>Visibility:</strong> {visibilityLabel}</p>

      {blockers.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Blocked by:</strong>
          {blockers.map(b => (
            <div key={b._id} style={{ margin: '4px 0 4px 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{b.status === 'done' ? '✅' : '🔴'}</span>
              <a href={`/tasks/${b._id}`} onClick={e => { e.preventDefault(); navigate(`/tasks/${b._id}`); }} style={{ flex: 1, color: '#1a73e8', textDecoration: b.status === 'done' ? 'line-through' : 'none' }}>
                {b.title}
              </a>
              {isOwner && <button onClick={() => removeBlocker(b._id)} style={{ fontSize: 11, padding: '2px 6px', color: 'red' }}>✕</button>}
            </div>
          ))}
        </div>
      )}

      {isOwner && (
        <div style={{ marginTop: 12 }}>
          <form onSubmit={e => { e.preventDefault(); addSubtask(); }} style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Add a subtask..." value={subtaskTitle} onChange={e => setSubtaskTitle(e.target.value)} style={{ flex: 1, padding: 6 }} />
            <button type="submit" style={{ padding: '6px 12px' }}>+ Subtask</button>
          </form>
        </div>
      )}

      {blocking.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Blocking:</strong>
          {blocking.map(b => (
            <div key={b._id} style={{ margin: '4px 0 4px 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{b.status === 'done' ? '✅' : '⏳'}</span>
              <a href={`/tasks/${b._id}`} onClick={e => { e.preventDefault(); navigate(`/tasks/${b._id}`); }} style={{ color: '#1a73e8', textDecoration: b.status === 'done' ? 'line-through' : 'none' }}>
                {b.title}
              </a>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <strong>Description:</strong>
        {editing ? (
          <div style={{ marginTop: 8 }}>
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4} style={{ width: '100%', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={saveDescription}>Save</button>
              <button onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 4 }}>
            <p style={{ whiteSpace: 'pre-wrap' }}>{task.description || <em>No description</em>}</p>
            {isOwner && <button onClick={() => { setDraft(task.description); setEditing(true); }}>✏️ Edit</button>}
          </div>
        )}
      </div>

      {task.descriptionHistory?.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <strong>Description History:</strong>
          {task.descriptionHistory.map((v, i) => (
            <div key={i} style={{ padding: 8, margin: '6px 0', background: '#f5f5f5', borderRadius: 4, fontSize: 14 }}>
              <div style={{ color: '#888', fontSize: 12 }}>{new Date(v.savedAt).toLocaleString()}</div>
              <div style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{v.description || <em>(empty)</em>}</div>
              {isOwner && <button onClick={() => rollback(i)} style={{ fontSize: 12 }}>↩ Rollback</button>}
            </div>
          ))}
        </div>
      )}

      <p style={{ color: '#888', fontSize: 13, marginTop: 16 }}>Created: {new Date(task.createdAt).toLocaleString()}</p>
      {isOwner && <p style={{ color: '#888', fontSize: 13 }}>You own this task</p>}
    </div>
  );
}
