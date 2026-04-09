import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

interface Task {
  _id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  shareToken: string;
}

export default function PublicTasksPage() {
  const { userId } = useParams<{ userId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    api.getPublicTasks(userId).then(setTasks).catch((err: any) => setError(err.message));
  }, [userId]);

  if (error) return <div style={{ maxWidth: 600, margin: '40px auto', padding: 24, color: 'red' }}>{error}</div>;

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <h1>Tasks</h1>
      {tasks.length === 0 ? (
        <p style={{ color: '#888' }}>No tasks found.</p>
      ) : (
        tasks.map(t => (
          <div key={t._id} style={{ padding: 12, borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 'bold', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
              {t.title}
            </div>
            {t.description && <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap', color: '#555' }}>{t.description}</p>}
            <div style={{ fontSize: 12, color: '#999' }}>
              {t.status} · {new Date(t.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
