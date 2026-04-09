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
  createdAt: string;
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getTask(id).then(setTask).catch((err: any) => setError(err.message));
  }, [id]);

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

  const rollback = async (index: number) => {
    const updated = await api.rollbackDescription(task._id, index);
    setTask(updated);
  };

  const visibilityLabel = { private: '🔒 Private', group: '👥 Group', public: '🌐 Public' }[task.visibility] || '';

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: 16 }}>← Back</button>
      <h1 style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</h1>
      <p style={{ color: '#666', fontSize: 14 }}>ID: {task._id}</p>
      <p><strong>Status:</strong> {task.status}</p>
      <p><strong>Visibility:</strong> {visibilityLabel}</p>

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
