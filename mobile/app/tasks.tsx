import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';
import { Redirect, useRouter } from 'expo-router';

interface Task {
  _id: string;
  title: string;
  status: string;
  deadline: string | null;
}

export default function Tasks() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');

  const loadTasks = useCallback(async () => {
    try {
      const res = await api.getTasks();
      setTasks(res.tasks);
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
      loadTasks();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const toggleDone = async (task: Task) => {
    await api.updateTask(task._id, { status: task.status === 'done' ? 'pending' : 'done' });
    loadTasks();
  };

  const handleDelete = async (id: string) => {
    await api.deleteTask(id);
    loadTasks();
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>MyTick</Text>
        <TouchableOpacity onPress={logout}><Text style={s.logout}>Logout</Text></TouchableOpacity>
      </View>
      <Text style={s.subtitle}>@{user.username}</Text>

      <View style={s.form}>
        <TextInput style={s.input} placeholder="Add a task..." value={title} onChangeText={setTitle} onSubmitEditing={handleCreate} />
        <TouchableOpacity style={s.addBtn} onPress={handleCreate}>
          <Text style={s.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
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
            <TouchableOpacity onPress={() => handleDelete(item._id)}>
              <Text style={s.deleteBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>No tasks yet</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#888', marginBottom: 16 },
  logout: { color: '#e53935', fontSize: 16 },
  form: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16 },
  addBtn: { backgroundColor: '#1a73e8', borderRadius: 8, width: 44, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: 'white', fontSize: 24 },
  task: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  check: { marginRight: 12 },
  taskBody: { flex: 1 },
  taskTitle: { fontSize: 16 },
  done: { textDecorationLine: 'line-through', color: '#888' },
  deadline: { fontSize: 12, color: '#f57c00', marginTop: 2 },
  deleteBtn: { color: 'red', fontSize: 18, paddingLeft: 12 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});
