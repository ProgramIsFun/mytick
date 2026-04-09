import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import TaskItem from '../components/TaskItem';
import TaskForm from '../components/TaskForm';
import GroupsPage from './GroupsPage';

interface Task {
  _id: string;
  title: string;
  description: string;
  status: string;
  visibility: string;
  groupIds: string[];
  shareToken: string;
  userId: string;
}

interface Group {
  _id: string;
  name: string;
  ownerId: string;
  members: { userId: string; role: string }[];
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tab, setTab] = useState<'tasks' | 'groups'>('tasks');
  const [showGroupTasks, setShowGroupTasks] = useState(false);
  const [error, setError] = useState('');

  const loadTasks = async () => {
    try { setTasks(await api.getTasks()); } catch (err: any) { setError(err.message); }
  };

  const loadGroups = async () => {
    try { setGroups(await api.getGroups()); } catch {} 
  };

  useEffect(() => { loadTasks(); loadGroups(); }, []);

  const handleCreate = async (title: string, groupIds: string[]) => {
    await api.createTask({ title, groupIds, visibility: groupIds.length > 0 ? 'group' : 'private' });
    loadTasks();
  };

  const handleUpdate = async (id: string, data: Record<string, unknown>) => {
    await api.updateTask(id, data);
    loadTasks();
  };

  const handleDelete = async (id: string) => {
    await api.deleteTask(id);
    loadTasks();
  };

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>MyTick</h1>
        <div>
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${user?.id}/tasks`); }} style={{ marginRight: 8 }} title="Copy public tasks link">🔗 Public Link</button>
          <span style={{ marginRight: 12 }}>{user?.name} ({user?.email})</span>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button onClick={() => setTab('tasks')} style={{ fontWeight: tab === 'tasks' ? 'bold' : 'normal', padding: '8px 16px' }}>
          Tasks
        </button>
        <button onClick={() => setTab('groups')} style={{ fontWeight: tab === 'groups' ? 'bold' : 'normal', padding: '8px 16px' }}>
          Groups
        </button>
      </div>

      {tab === 'tasks' ? (
        <>
          <TaskForm groups={groups} onCreate={handleCreate} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 14 }}>
            <input type="checkbox" checked={showGroupTasks} onChange={() => setShowGroupTasks(!showGroupTasks)} />
            Show group tasks
          </label>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          {tasks.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>No tasks yet. Create one above!</p>
          ) : (
            tasks.filter(t => showGroupTasks || t.userId === user?.id).map(task => (
              <TaskItem
                key={task._id}
                task={task}
                groups={groups}
                isOwner={task.userId === user?.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))
          )}
        </>
      ) : (
        <GroupsPage />
      )}
      <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #eee', fontSize: 12, color: '#aaa', textAlign: 'center' }}>
        v1.0.0
      </div>
    </div>
  );
}
