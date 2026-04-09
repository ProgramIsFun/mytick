import { useState } from 'react';

interface Task {
  _id: string;
  title: string;
  status: string;
  visibility: string;
  shareToken: string;
}

interface Props {
  task: Task;
  isOwner: boolean;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

export default function TaskItem({ task, isOwner, onUpdate, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const isDone = task.status === 'done';

  const toggleDone = () => {
    onUpdate(task._id, { status: isDone ? 'pending' : 'done' });
  };

  const cycleVisibility = () => {
    const next = task.visibility === 'private' ? 'group' : task.visibility === 'group' ? 'public' : 'private';
    onUpdate(task._id, { visibility: next });
  };

  const copyLink = () => {
    const url = `${window.location.origin}/share/${task.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const visibilityLabel = { private: '🔒 Private', group: '👥 Group', public: '🌐 Public' }[task.visibility] || task.visibility;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: 12,
      borderBottom: '1px solid #eee', opacity: isDone ? 0.5 : 1,
    }}>
      <input type="checkbox" checked={isDone} onChange={toggleDone} disabled={!isOwner} />
      <span style={{ flex: 1, textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</span>

      {isOwner && (
        <>
          <button onClick={cycleVisibility} title="Toggle visibility" style={{ fontSize: 12, padding: '4px 8px' }}>
            {visibilityLabel}
          </button>
          {task.visibility === 'public' && (
            <button onClick={copyLink} style={{ fontSize: 12, padding: '4px 8px' }}>
              {copied ? '✅ Copied' : '🔗 Share'}
            </button>
          )}
          <button onClick={() => onDelete(task._id)} style={{ fontSize: 12, padding: '4px 8px', color: 'red' }}>
            ✕
          </button>
        </>
      )}
    </div>
  );
}
