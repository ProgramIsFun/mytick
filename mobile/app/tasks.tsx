import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Switch, StyleSheet, Alert, Share } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';
import { Redirect, useRouter } from 'expo-router';
import CalendarView from '../src/components/CalendarView';

interface Task {
  _id: string;
  title: string;
  status: string;
  visibility: string;
  userId: string;
  deadline: string | null;
  groupIds: string[];
}

export default function Tasks() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [showGroupTasks, setShowGroupTasks] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tab, setTab] = useState<'tasks' | 'calendar' | 'groups' | 'settings'>('tasks');

  const loadTasks = useCallback(async (p = 1) => {
    try {
      const res = await api.getTasks(p);
      setTasks(res.tasks);
      setTotalPages(res.totalPages);
      setPage(res.page);
    } catch {}
  }, []);

  useEffect(() => { if (user) loadTasks(); }, [user, loadTasks]);

  if (loading) return <View style={s.center}><Text>Loading...</Text></View>;
  if (!user) return <Redirect href="/" />;

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      await api.createTask({ title: title.trim() });
      setTitle('');
      loadTasks(page);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const toggleDone = async (task: Task) => {
    await api.updateTask(task._id, { status: task.status === 'done' ? 'pending' : 'done' });
    loadTasks(page);
  };

  const cycleVisibility = async (task: Task) => {
    const next = task.visibility === 'private' ? 'group' : task.visibility === 'group' ? 'public' : 'private';
    await api.updateTask(task._id, { visibility: next });
    loadTasks(page);
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteTask(id); loadTasks(page); } },
    ]);
  };

  const visIcon = (v: string) => ({ private: '🔒', group: '👥', public: '🌐' }[v] || '');
  const filtered = tasks.filter(t => showGroupTasks || t.userId === user?.id);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>MyTick</Text>
        <TouchableOpacity onPress={logout}><Text style={s.logout}>Logout</Text></TouchableOpacity>
      </View>
      <Text style={s.subtitle}>@{user.username}</Text>

      <View style={s.tabs}>
        {(['tasks', 'calendar', 'groups', 'settings'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t[0].toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'tasks' && (
        <>
          <View style={s.form}>
            <TextInput style={s.input} placeholder="Add a task..." value={title} onChangeText={setTitle} onSubmitEditing={handleCreate} />
            <TouchableOpacity style={s.addBtn} onPress={handleCreate}>
              <Text style={s.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>Show group tasks</Text>
            <Switch value={showGroupTasks} onValueChange={setShowGroupTasks} />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={t => t._id}
            renderItem={({ item }) => (
              <View style={s.task}>
                <TouchableOpacity onPress={() => toggleDone(item)} style={s.check}>
                  <Text>{item.status === 'done' ? '✅' : '⬜'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.taskBody} onPress={() => router.push(`/task/${item._id}`)}>
                  <Text style={[s.taskTitle, item.status === 'done' && s.done]}>{item.title}</Text>
                  {item.deadline && <Text style={s.deadline}>📅 {new Date(item.deadline).toLocaleDateString()}</Text>}
                </TouchableOpacity>
                {item.userId === user?.id && (
                  <>
                    <TouchableOpacity onPress={() => cycleVisibility(item)} style={s.visBtn}>
                      <Text>{visIcon(item.visibility)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item._id)}>
                      <Text style={s.deleteBtn}>✕</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
            ListEmptyComponent={<Text style={s.empty}>No tasks yet</Text>}
          />

          {totalPages > 1 && (
            <View style={s.pagination}>
              <TouchableOpacity disabled={page <= 1} onPress={() => loadTasks(page - 1)}>
                <Text style={[s.pageBtn, page <= 1 && s.disabled]}>← Prev</Text>
              </TouchableOpacity>
              <Text style={s.pageInfo}>{page} / {totalPages}</Text>
              <TouchableOpacity disabled={page >= totalPages} onPress={() => loadTasks(page + 1)}>
                <Text style={[s.pageBtn, page >= totalPages && s.disabled]}>Next →</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {tab === 'settings' && <SettingsTab />}
      {tab === 'groups' && <Text style={s.empty}>Groups — coming soon</Text>}
      {tab === 'calendar' && <CalendarView tasks={tasks} />}
    </View>
  );
}

function SettingsTab() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [name, setName] = useState(user?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');

  const save = async () => {
    try {
      const data: any = { username, name };
      if (newPassword) data.newPassword = newPassword;
      await api.updateMe(data);
      setNewPassword('');
      setMsg('Saved!');
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Username</Text>
      <TextInput style={ss.input} value={username}
        onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))} autoCapitalize="none" />
      <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Display Name</Text>
      <TextInput style={ss.input} value={name} onChangeText={setName} />
      <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>New Password</Text>
      <TextInput style={ss.input} value={newPassword} onChangeText={setNewPassword}
        placeholder="Leave blank to keep current" secureTextEntry />
      {msg ? <Text style={{ color: 'green', marginBottom: 8 }}>{msg}</Text> : null}
      <TouchableOpacity style={ss.btn} onPress={save}>
        <Text style={ss.btnText}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

const ss = StyleSheet.create({
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 16 },
  btn: { backgroundColor: '#1a73e8', borderRadius: 8, padding: 12, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600' },
});

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#888', marginBottom: 8 },
  logout: { color: '#e53935', fontSize: 16 },
  tabs: { flexDirection: 'row', marginBottom: 16, gap: 4 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  tabActive: { backgroundColor: '#1a73e8' },
  tabText: { fontSize: 14, color: '#666' },
  tabTextActive: { color: 'white', fontWeight: 'bold' },
  form: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16 },
  addBtn: { backgroundColor: '#1a73e8', borderRadius: 8, width: 44, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: 'white', fontSize: 24 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  toggleLabel: { fontSize: 14, color: '#666' },
  task: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  check: { marginRight: 12 },
  taskBody: { flex: 1 },
  taskTitle: { fontSize: 16 },
  done: { textDecorationLine: 'line-through', color: '#888' },
  deadline: { fontSize: 12, color: '#f57c00', marginTop: 2 },
  visBtn: { paddingHorizontal: 8 },
  deleteBtn: { color: 'red', fontSize: 18, paddingLeft: 8 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16 },
  pageBtn: { color: '#1a73e8', fontSize: 16 },
  pageInfo: { fontSize: 14, color: '#666' },
  disabled: { color: '#ccc' },
});
