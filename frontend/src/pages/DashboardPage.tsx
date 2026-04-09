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
  const [error, setError] = useState('');

  const loadTasks = async () => {
    try { setTasks(await api.getTasks()); } catch (err: any) { setError(err.message); }
  };

  const loadGroups = async () => {
    try { setGroups(await api.getGroups()); } catch {} 
  };

  useEffect(() => { loadTasks(); loadGroups(); }, []);

  const handleCreate = async (title: string) => {
    await api.createTask({ title });
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
          <span style={{ marginRight: 12 }}>{user?.name}</span>
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
          <TaskForm onCreate={handleCreate} />
          {error && <p style={{ color: 'red' }}>{error}</p>}
          {tasks.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>No tasks yet. Create one above!</p>
          ) : (
            tasks.map(task => (
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
    </div>
  );
}
