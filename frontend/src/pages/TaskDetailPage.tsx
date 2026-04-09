import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

interface Task {
  _id: string;
  title: string;
  description: string;
  status: string;
  visibility: string;
  groupIds: string[];
  shareToken: string;
  userId: string;
  createdAt: string;
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState('');

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
  const visibilityLabel = { private: '🔒 Private', group: '👥 Group', public: '🌐 Public' }[task.visibility] || '';

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: 16 }}>← Back</button>
      <h1 style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</h1>
      <p style={{ color: '#666', fontSize: 14 }}>ID: {task._id}</p>
      <p><strong>Status:</strong> {task.status}</p>
      <p><strong>Visibility:</strong> {visibilityLabel}</p>
      {task.description && <p><strong>Description:</strong> {task.description}</p>}
      <p style={{ color: '#888', fontSize: 13 }}>Created: {new Date(task.createdAt).toLocaleString()}</p>
      {isOwner && <p style={{ color: '#888', fontSize: 13 }}>You own this task</p>}
    </div>
  );
}
