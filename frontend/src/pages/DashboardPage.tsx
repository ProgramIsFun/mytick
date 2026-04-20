import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDeadlineAlerts } from '../hooks/useDeadlineAlerts';
import { api } from '../api/client';
import TaskItem from '../components/TaskItem';
import TaskForm from '../components/TaskForm';
import CalendarView from '../components/CalendarView';
import GroupsPage from './GroupsPage';

interface Task {
  _id: string; title: string; description: string; status: string;
  visibility: string; groupIds: string[]; shareToken: string; userId: string;
  deadline: string | null;
}

interface Group {
  _id: string; name: string; ownerId: string;
  members: { userId: string; role: string }[];
}

type Tab = 'tasks' | 'calendar' | 'groups';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useDeadlineAlerts();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tab, setTab] = useState<Tab>('tasks');
  const [showGroupTasks, setShowGroupTasks] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [allTags, setAllTags] = useState<string[]>([]);

  const loadTasks = async (p = page) => {
    try {
      const res = await api.getTasks(p, 20, typeFilter, tagFilter, searchQuery || undefined);
      setTasks(res.tasks); setTotalPages(res.totalPages); setPage(res.page);
      // Collect unique tags
      const tags = new Set<string>(allTags);
      res.tasks.forEach((t: any) => t.tags?.forEach((tag: string) => tags.add(tag)));
      setAllTags([...tags].sort());
    } catch (err: any) { setError(err.message); }
  };

  const loadGroups = async () => { try { setGroups(await api.getGroups()); } catch {} };

  useEffect(() => { loadTasks(); loadGroups(); }, []);
  useEffect(() => { loadTasks(1); }, [typeFilter, tagFilter]);
  useEffect(() => {
    const t = setTimeout(() => loadTasks(1), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleCreate = async (title: string, groupIds: string[], deadline?: string, recurrence?: { freq: string; interval: number } | null) => {
    await api.createTask({ title, groupIds, visibility: groupIds.length > 0 ? 'group' : 'private', deadline, recurrence, type: typeFilter === 'project' ? 'project' : 'task' });
    loadTasks();
  };

  const handleUpdate = async (id: string, data: Record<string, unknown>) => {
    await api.updateTask(id, data); loadTasks();
  };

  const handleDelete = async (id: string) => {
    await api.deleteTask(id); loadTasks();
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'tasks', label: 'Tasks', icon: '☑️' },
    { key: 'calendar', label: 'Calendar', icon: '📅' },
    { key: 'groups', label: 'Groups', icon: '👥' },
  ];

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-text-primary">MyTick</h1>
            <nav className="flex gap-1">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    tab === t.key
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/accounts')}
              className="text-sm px-3 py-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              🔑 Accounts
            </button>
            <button
              onClick={() => navigate('/domains')}
              className="text-sm px-3 py-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              🌐 Domains
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="text-sm px-3 py-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              ⚙️ {user?.name}
            </button>
            <button
              onClick={logout}
              className="text-sm px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-danger hover:border-danger/30 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {tab === 'tasks' && (
          <>
            <TaskForm groups={groups.filter(g => g.members.some(m => m.userId === user?.id && m.role === 'editor'))} onCreate={handleCreate} />

            <div className="flex items-center justify-between mt-6 mb-3">
              <div className="flex items-center gap-1">
                {([['All', undefined], ['Tasks', 'task'], ['Projects', 'project']] as [string, string | undefined][]).map(([label, value]) => (
                  <button
                    key={label}
                    onClick={() => setTypeFilter(value)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      typeFilter === value
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {allTags.length > 0 && (
                  <>
                    <span className="text-text-muted text-xs mx-1">|</span>
                    {allTags.map(t => (
                      <button key={t} onClick={() => setTagFilter(tagFilter === t ? undefined : t)}
                        className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${tagFilter === t ? 'bg-accent text-white' : 'bg-surface-secondary text-text-muted hover:text-text-primary'}`}>
                        {t}
                      </button>
                    ))}
                  </>
                )}
              </div>
              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGroupTasks}
                  onChange={() => setShowGroupTasks(!showGroupTasks)}
                  className="rounded border-border accent-accent"
                />
                Show group tasks
              </label>
              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDone}
                  onChange={() => setShowDone(!showDone)}
                  className="rounded border-border accent-accent"
                />
                Show done
              </label>
            </div>

            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 mb-3"
            />

            {error && <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md mb-3">{error}</div>}

            <div className="border border-border rounded-lg overflow-hidden bg-surface">
              {tasks.length === 0 ? (
                <div className="text-center py-12 text-text-muted text-sm">
                  No tasks yet. Create one above!
                </div>
              ) : (
                tasks.filter(t => (showGroupTasks || t.userId === user?.id) && (showDone || (t.status !== 'done' && t.status !== 'abandoned'))).map(task => (
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
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  disabled={page <= 1}
                  onClick={() => loadTasks(page - 1)}
                  className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-sm text-text-muted">{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => loadTasks(page + 1)}
                  className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'calendar' && <CalendarView />}
        {tab === 'groups' && <GroupsPage />}
      </main>
    </div>
  );
}
