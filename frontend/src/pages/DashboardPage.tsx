import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import TaskItem from '../components/TaskItem';
import TaskForm from '../components/TaskForm';

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

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');

  const loadTasks = async () => {
    try {
      setTasks(await api.getTasks());
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => { loadTasks(); }, []);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>MyTick</h1>
        <div>
          <span style={{ marginRight: 12 }}>{user?.name}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <TaskForm onCreate={handleCreate} />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {tasks.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>No tasks yet. Create one above!</p>
      ) : (
        tasks.map(task => (
          <TaskItem
            key={task._id}
            task={task}
            isOwner={task.userId === user?.id}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))
      )}
    </div>
  );
}
