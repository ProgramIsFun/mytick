import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Task {
  _id: string;
  title: string;
  status: string;
  type?: string;
  visibility: string;
  groupIds: string[];
  shareToken: string;
  deadline: string | null;
  tags?: string[];
  pinned?: boolean;
  metadata?: { projectType?: string; repoUrl?: string; localPath?: string; environments?: string[]; services?: unknown[]; members?: unknown[] } | null;
}

interface Group { _id: string; name: string; }

interface Props {
  task: Task;
  groups: Group[];
  isOwner: boolean;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-warning/15 text-warning' },
  in_progress: { label: 'In Progress', cls: 'bg-accent/15 text-accent' },
  on_hold: { label: 'On Hold', cls: 'bg-purple/15 text-purple' },
  done: { label: 'Done', cls: 'bg-success/15 text-success' },
  abandoned: { label: 'Abandoned', cls: 'bg-gray/15 text-gray' },
};

export default function TaskItem({ task, groups: _groups, isOwner, onUpdate, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const isDone = task.status === 'done';
  const badge = STATUS_BADGE[task.status] || STATUS_BADGE.pending;

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${task.shareToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const visIcon = { private: '🔒', group: '👥', public: '🌐' }[task.visibility] || '';

  return (
    <div className={`group flex items-center gap-3 px-4 py-3 border-b border-border-light hover:bg-surface-hover transition-colors ${isDone || task.status === 'abandoned' ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={isDone}
        onChange={() => onUpdate(task._id, { status: isDone ? 'pending' : 'done' })}
        disabled={!isOwner}
        className="w-4 h-4 rounded border-border accent-accent cursor-pointer"
      />

      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/tasks/${task._id}`)}>
        <div className={`text-sm font-medium truncate ${isDone ? 'line-through text-text-muted' : 'text-text-primary'}`}>
          {task.type === 'project' && <span className="mr-1">📁</span>}
          {task.title}
        </div>
        {task.metadata?.repoUrl && (
          <div className="text-xs text-text-muted mt-0.5 truncate">🔗 {task.metadata.repoUrl}</div>
        )}
        {task.tags && task.tags.length > 0 && (
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {task.tags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{t}</span>
            ))}
          </div>
        )}
        {task.deadline && (
          <div className="text-xs text-text-muted mt-0.5">
            📅 {new Date(task.deadline).toLocaleDateString()}
          </div>
        )}
      </div>

      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
        {badge.label}
      </span>

      {task.pinned && <span className="text-xs" title="Pinned">📌</span>}

      <span className="text-xs" title={task.visibility}>{visIcon}</span>

      {isOwner && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onUpdate(task._id, { pinned: !task.pinned })} className="text-xs px-2 py-1 rounded hover:bg-surface-hover border border-transparent" title={task.pinned ? 'Unpin' : 'Pin'}>
            {task.pinned ? '📌' : '📍'}
          </button>
          {task.visibility === 'public' && (
            <button onClick={copyLink} className="text-xs px-2 py-1 rounded hover:bg-surface-hover border border-border">
              {copied ? '✅' : '🔗'}
            </button>
          )}
          <button
            onClick={() => onDelete(task._id)}
            className="text-xs px-2 py-1 rounded hover:bg-danger/10 text-danger border border-transparent hover:border-danger/20"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
