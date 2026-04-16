import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

export default function SharedTaskPage() {
  const { token } = useParams<{ token: string }>();
  const [task, setTask] = useState<{ title: string; description: string; status: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { if (token) api.getSharedTask(token).then(setTask).catch((e: any) => setError(e.message)); }, [token]);

  if (error) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Task not found</h2>
        <p className="text-sm text-text-muted">This task may be private or doesn't exist.</p>
      </div>
    </div>
  );

  if (!task) return <div className="min-h-screen bg-surface flex items-center justify-center text-text-muted">Loading...</div>;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        <h1 className="text-2xl font-bold text-text-primary mb-1">MyTick</h1>
        <div className="border border-border rounded-lg p-5 bg-surface-secondary mt-4">
          <h2 className="text-lg font-semibold text-text-primary">{task.title}</h2>
          {task.description && <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">{task.description}</p>}
          <p className="text-xs text-text-muted mt-3">Status: <strong>{task.status}</strong></p>
        </div>
      </div>
    </div>
  );
}
