import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import { useTheme } from '../../src/context/ThemeContext';

export default function TaskDetail() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<any>(null);
  const [blockers, setBlockers] = useState<any[]>([]);
  const [blocking, setBlocking] = useState<any[]>([]);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getTask(id).then(setTask).catch(() => router.back());
    api.getBlocking(id).then(setBlocking).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!task?.blockedBy?.length) { setBlockers([]); return; }
    Promise.all(task.blockedBy.map((bid: string) => api.getTask(bid).catch(() => null)))
      .then(r => setBlockers(r.filter(Boolean)));
  }, [task?.blockedBy]);

  if (!task) return <View style={[s.center, { backgroundColor: c.bg }]}><Text style={{ color: c.text }}>Loading...</Text></View>;

  const saveTitle = async () => {
    if (!titleDraft.trim() || titleDraft === task.title) { setEditingTitle(false); return; }
    const updated = await api.updateTask(task._id, { title: titleDraft.trim() });
    setTask(updated);
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    if (descDraft === task.description) { setEditingDesc(false); return; }
    const updated = await api.updateTask(task._id, { description: descDraft });
    setTask(updated);
    setEditingDesc(false);
  };

  const rollback = async (index: number) => {
    const updated = await api.rollbackDescription(task._id, index);
    setTask(updated);
  };

  const addSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    const sub = await api.createTask({ title: subtaskTitle.trim() });
    const updated = await api.updateTask(task._id, { blockedBy: [...(task.blockedBy || []), sub._id] });
    setTask(updated);
    setSubtaskTitle('');
  };

  const removeBlocker = async (blockerId: string) => {
    const updated = await api.updateTask(task._id, { blockedBy: task.blockedBy.filter((id: string) => id !== blockerId) });
    setTask(updated);
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: c.bg }]}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={[s.back, { color: c.link }]}>← Back</Text>
      </TouchableOpacity>

      {editingTitle ? (
        <View>
          <TextInput style={[s.titleInput, { color: c.text, borderBottomColor: c.link }]} value={titleDraft} onChangeText={setTitleDraft} autoFocus
            onSubmitEditing={saveTitle} />
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, { backgroundColor: c.link }]} onPress={saveTitle}><Text style={s.btnText}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingTitle(false)}><Text style={[s.cancel, { color: c.textMuted }]}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => { setTitleDraft(task.title); setEditingTitle(true); }}>
          <Text style={[s.title, task.status === 'done' && s.done, { color: task.status === 'done' ? c.textMuted : c.text }]}>{task.title} ✏️</Text>
        </TouchableOpacity>
      )}

      <Text style={[s.meta, { color: c.textSecondary }]}>Status: {task.status}</Text>
      <Text style={[s.meta, { color: c.textSecondary }]}>Visibility: {{ private: '🔒 Private', group: '👥 Group', public: '🌐 Public' }[task.visibility as string]}</Text>
      {task.deadline && <Text style={[s.meta, { color: c.textSecondary }]}>📅 Deadline: {new Date(task.deadline).toLocaleString()}</Text>}

      {blockers.length > 0 && (
        <View style={s.section}>
          <Text style={[s.label, { color: c.text }]}>Blocked by:</Text>
          {blockers.map(b => (
            <View key={b._id} style={s.blockerRow}>
              <Text>{b.status === 'done' ? '✅' : '🔴'}</Text>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/task/${b._id}`)}>
                <Text style={[s.link, b.status === 'done' && s.done, { color: c.link }]}>{b.title}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeBlocker(b._id)}>
                <Text style={{ color: c.danger }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={s.section}>
        <View style={s.subtaskForm}>
          <TextInput style={[s.input, { flex: 1, borderColor: c.inputBorder, backgroundColor: c.btnBg, color: c.text }]} placeholder="Add subtask..." placeholderTextColor={c.textMuted} value={subtaskTitle}
            onChangeText={setSubtaskTitle} onSubmitEditing={addSubtask} />
          <TouchableOpacity style={[s.btn, { backgroundColor: c.link }]} onPress={addSubtask}><Text style={s.btnText}>+ Subtask</Text></TouchableOpacity>
        </View>
      </View>

      {blocking.length > 0 && (
        <View style={s.section}>
          <Text style={[s.label, { color: c.text }]}>Blocking:</Text>
          {blocking.map(b => (
            <TouchableOpacity key={b._id} onPress={() => router.push(`/task/${b._id}`)}>
              <Text style={[s.link, { color: c.link }]}>{b.status === 'done' ? '✅' : '⏳'} {b.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.section}>
        <Text style={[s.label, { color: c.text }]}>Description:</Text>
        {editingDesc ? (
          <View>
            <TextInput style={[s.textarea, { borderColor: c.inputBorder, backgroundColor: c.btnBg, color: c.text }]} value={descDraft} onChangeText={setDescDraft} multiline placeholderTextColor={c.textMuted} />
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, { backgroundColor: c.link }]} onPress={saveDesc}><Text style={s.btnText}>Save</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingDesc(false)}><Text style={[s.cancel, { color: c.textMuted }]}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <Text style={[s.desc, { color: c.text }]}>{task.description || 'No description'}</Text>
            <TouchableOpacity onPress={() => { setDescDraft(task.description); setEditingDesc(true); }}>
              <Text style={[s.edit, { color: c.link }]}>✏️ Edit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {task.descriptionHistory?.length > 0 && (
        <View style={s.section}>
          <Text style={[s.label, { color: c.text }]}>Description History:</Text>
          {task.descriptionHistory.map((v: any, i: number) => (
            <View key={i} style={[s.historyItem, { backgroundColor: c.bgSecondary }]}>
              <Text style={[s.historyDate, { color: c.textMuted }]}>{new Date(v.savedAt).toLocaleString()}</Text>
              <Text style={[s.historyText, { color: c.textSecondary }]}>{v.description || '(empty)'}</Text>
              <TouchableOpacity onPress={() => rollback(i)}>
                <Text style={[s.link, { color: c.link }]}>↩ Rollback</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <Text style={[s.meta, { marginTop: 16, color: c.textMuted }]}>Created: {new Date(task.createdAt).toLocaleString()}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  back: { color: '#1a73e8', fontSize: 16, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  titleInput: { fontSize: 24, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: '#1a73e8', paddingBottom: 4, marginBottom: 8 },
  done: { textDecorationLine: 'line-through', color: '#888' },
  meta: { color: '#666', marginBottom: 4 },
  section: { marginTop: 20 },
  label: { fontWeight: 'bold', marginBottom: 8 },
  desc: { fontSize: 16, color: '#333' },
  edit: { color: '#1a73e8', marginTop: 8 },
  textarea: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16, minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  btnText: { color: 'white', fontWeight: '600' },
  cancel: { color: '#888', paddingVertical: 8 },
  link: { color: '#1a73e8', paddingVertical: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, fontSize: 14 },
  subtaskForm: { flexDirection: 'row', gap: 8 },
  blockerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  historyItem: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, marginBottom: 8 },
  historyDate: { fontSize: 12, color: '#888' },
  historyText: { fontSize: 14, marginVertical: 4 },
});
