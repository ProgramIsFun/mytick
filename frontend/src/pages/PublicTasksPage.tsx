import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

interface Task { _id: string; title: string; description: string; status: string; createdAt: string; }

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-warning/15 text-warning' },
  in_progress: { label: 'In Progress', cls: 'bg-accent/15 text-accent' },
  on_hold: { label: 'On Hold', cls: 'bg-purple/15 text-purple' },
  done: { label: 'Done', cls: 'bg-success/15 text-success' },
  abandoned: { label: 'Abandoned', cls: 'bg-gray/15 text-gray' },
};

export default function PublicTasksPage() {
  const { username } = useParams<{ username: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { if (username) api.getPublicTasksByUsername(username).then(setTasks).catch((e: any) => setError(e.message)); }, [username]);

  if (error) return <div className="min-h-screen bg-surface flex items-center justify-center text-danger">{error}</div>;

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <h1 className="text-lg font-semibold text-text-primary">@{username}'s Tasks</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">No public tasks found.</div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            {tasks.map(t => {
              const badge = STATUS_BADGE[t.status] || STATUS_BADGE.pending;
              return (
                <div key={t._id} className="px-4 py-3 border-b border-border-light">
                  <div className="flex items-center gap-3">
                    <span className={`flex-1 text-sm font-medium ${t.status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'}`}>{t.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                    <span className="text-xs text-text-muted">{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                  {t.description && <p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap">{t.description}</p>}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
