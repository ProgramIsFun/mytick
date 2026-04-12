import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api/client';

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (id) api.getTask(id).then(setTask).catch(() => router.back());
  }, [id]);

  if (!task) return <View style={s.center}><Text>Loading...</Text></View>;

  const saveDescription = async () => {
    if (draft === task.description) { setEditing(false); return; }
    const updated = await api.updateTask(task._id, { description: draft });
    setTask(updated);
    setEditing(false);
  };

  return (
    <ScrollView style={s.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={s.back}>← Back</Text>
      </TouchableOpacity>

      <Text style={[s.title, task.status === 'done' && s.done]}>{task.title}</Text>
      <Text style={s.meta}>Status: {task.status}</Text>
      {task.deadline && <Text style={s.meta}>📅 Deadline: {new Date(task.deadline).toLocaleString()}</Text>}

      <Text style={s.label}>Description</Text>
      {editing ? (
        <View>
          <TextInput style={s.textarea} value={draft} onChangeText={setDraft} multiline numberOfLines={4} />
          <View style={s.row}>
            <TouchableOpacity style={s.btn} onPress={saveDescription}><Text style={s.btnText}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(false)}><Text style={s.cancel}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <View>
          <Text style={s.desc}>{task.description || 'No description'}</Text>
          <TouchableOpacity onPress={() => { setDraft(task.description); setEditing(true); }}>
            <Text style={s.edit}>✏️ Edit</Text>
          </TouchableOpacity>
        </View>
      )}

      {task.blockedBy?.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={s.label}>Blocked by</Text>
          {task.blockedBy.map((bid: string) => (
            <TouchableOpacity key={bid} onPress={() => router.push(`/task/${bid}`)}>
              <Text style={s.link}>{bid}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  back: { color: '#1a73e8', fontSize: 16, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  done: { textDecorationLine: 'line-through', color: '#888' },
  meta: { color: '#666', marginBottom: 4 },
  label: { fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  desc: { fontSize: 16, color: '#333' },
  edit: { color: '#1a73e8', marginTop: 8 },
  textarea: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16, minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  btnText: { color: 'white', fontWeight: '600' },
  cancel: { color: '#888', paddingVertical: 8 },
  link: { color: '#1a73e8', paddingVertical: 4 },
});
