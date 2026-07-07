import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDeadlineAlerts } from '../hooks/useDeadlineAlerts';
import { api } from '../api/client';
import TaskItem from '../components/TaskItem';
import TaskForm from '../components/TaskForm';
import CalendarView from '../components/CalendarView';
import Spinner from '../components/Spinner';
import GroupsPage from './GroupsPage';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import Alert from '../components/Alert';
import type { Group } from '../types/group';
import type { TaskItemData as Task } from '../types/task';

type Tab = 'tasks' | 'calendar' | 'groups';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useDeadlineAlerts();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tab, setTab] = useState<Tab>('tasks');
  const [showMenu, setShowMenu] = useState(false);
  const [showGroupTasks, setShowGroupTasks] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const loadTasks = async (p = page) => {
    try {
      setLoadingTasks(true);
      const res = await api.getTasks(p, 20, typeFilter, tagFilter, searchQuery || undefined, showDone ? undefined : 'done,abandoned');
      setTasks(res.tasks); setTotalPages(res.totalPages); setPage(res.page);
      // Collect unique tags
      const tags = new Set<string>(allTags);
      res.tasks.forEach((t: any) => t.tags?.forEach((tag: string) => tags.add(tag)));
      setAllTags([...tags].sort());
    } catch (err: any) { setError(err.message); }
    finally { setLoadingTasks(false); }
  };

  const loadGroups = async () => { try { setGroups(await api.getGroups()); } catch {} };

  useEffect(() => { loadTasks(); loadGroups(); }, []);
  useEffect(() => { loadTasks(1); }, [typeFilter, tagFilter, showDone]);
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
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-sm px-3 py-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
              >
                ⚙️ {user?.name} ▾
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-surface border border-border rounded-md shadow-lg py-1">
                    <button onClick={() => { navigate('/subscriptions'); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary">💳 Subscriptions</button>
                    <button onClick={() => { navigate('/accounts'); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary">🔑 Accounts</button>
                    <button onClick={() => { navigate('/domains'); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary">🌐 Domains</button>
                    <button onClick={() => { navigate('/databases'); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary">🗄️ Databases</button>
                    <button onClick={() => { navigate('/secrets'); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary">🔐 Secrets</button>
                    <button onClick={() => { navigate('/context'); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary">📋 Context</button>
                    <button onClick={() => { navigate('/knowledge'); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary">🧠 Knowledge</button>
                    <button onClick={() => { navigate('/settings'); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary">⚙️ Settings</button>
                    <hr className="my-1 border-border-light" />
                    <button onClick={logout} className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-danger">🚪 Logout</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {tab === 'tasks' && (
          <>
            <TaskForm groups={groups.filter(g => g.members.some(m => m.userId === user?.id && m.role === 'editor'))} onCreate={handleCreate} />

            <div className="flex items-center justify-between mt-6 mb-3 gap-2">
              <div className="flex items-center gap-1 flex-wrap">
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

            {error && <Alert message={error} />}

            <div className="border border-border rounded-lg overflow-hidden bg-surface">
              {loadingTasks ? (
                <Spinner text="Loading tasks..." />
              ) : tasks.length === 0 ? (
                <EmptyState message="No tasks yet. Create one above!" />
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
            </div>

            <Pagination page={page} totalPages={totalPages} onPage={loadTasks} />
          </>
        )}

        {tab === 'calendar' && <CalendarView />}
        {tab === 'groups' && <GroupsPage />}
      </main>
    </div>
  );
}
