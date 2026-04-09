import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

export default function SharedTaskPage() {
  const { token } = useParams<{ token: string }>();
  const [task, setTask] = useState<{ title: string; description: string; status: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    api.getSharedTask(token)
      .then(setTask)
      .catch((err: any) => setError(err.message));
  }, [token]);

  if (error) return <div style={{ maxWidth: 400, margin: '80px auto', textAlign: 'center' }}><h2>Task not found</h2><p>This task may be private or doesn't exist.</p></div>;
  if (!task) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
      <h1>MyTick</h1>
      <h2>{task.title}</h2>
      {task.description && <p>{task.description}</p>}
      <p>Status: <strong>{task.status}</strong></p>
    </div>
  );
}
