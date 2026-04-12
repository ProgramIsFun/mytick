import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Task {
  _id: string;
  title: string;
  status: string;
  visibility: string;
  groupIds: string[];
  shareToken: string;
}

interface Group {
  _id: string;
  name: string;
}

interface Props {
  task: Task;
  groups: Group[];
  isOwner: boolean;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

export default function TaskItem({ task, groups, isOwner, onUpdate, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const navigate = useNavigate();
  const isDone = task.status === 'done';

  const toggleDone = () => onUpdate(task._id, { status: isDone ? 'pending' : 'done' });

  const cycleVisibility = () => {
    const next = task.visibility === 'private' ? 'group' : task.visibility === 'group' ? 'public' : 'private';
    onUpdate(task._id, { visibility: next });
  };

  const toggleGroup = (groupId: string) => {
    const current = task.groupIds || [];
    const next = current.includes(groupId) ? current.filter(id => id !== groupId) : [...current, groupId];
    onUpdate(task._id, { groupIds: next });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${task.shareToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const visibilityLabel = { private: '🔒', group: '👥', public: '🌐' }[task.visibility] || '';

  return (
    <div style={{ padding: 12, borderBottom: '1px solid var(--border)', opacity: isDone ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={isDone} onChange={toggleDone} disabled={!isOwner} />
        <span
          onClick={() => navigate(`/tasks/${task._id}`)}
          style={{ flex: 1, textDecoration: isDone ? 'line-through' : 'none', cursor: 'pointer' }}
        >{task.title}</span>

        {isOwner && (
          <>
            <button onClick={cycleVisibility} title="Toggle visibility" style={{ fontSize: 12, padding: '4px 8px' }}>
              {visibilityLabel}
            </button>
            {task.visibility === 'group' && (
              <button onClick={() => setShowGroups(!showGroups)} style={{ fontSize: 12, padding: '4px 8px' }}>
                📂
              </button>
            )}
            {task.visibility === 'public' && (
              <button onClick={copyLink} style={{ fontSize: 12, padding: '4px 8px' }}>
                {copied ? '✅' : '🔗'}
              </button>
            )}
            <button onClick={() => onDelete(task._id)} style={{ fontSize: 12, padding: '4px 8px', color: 'red' }}>
              ✕
            </button>
          </>
        )}
      </div>

      {showGroups && isOwner && (
        <div style={{ marginTop: 8, marginLeft: 28, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {groups.map(g => (
            <label key={g._id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={(task.groupIds || []).includes(g._id)}
                onChange={() => toggleGroup(g._id)}
              />
              {g.name}
            </label>
          ))}
          {groups.length === 0 && <span style={{ fontSize: 13, color: '#888' }}>No groups yet</span>}
        </div>
      )}
    </div>
  );
}
