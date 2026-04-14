import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Member {
  userId: string;
  role: string;
  username?: string;
  name?: string;
}

interface Group {
  _id: string;
  name: string;
  ownerId: string;
  members: Member[];
}

interface Props {
  colors: { bg: string; text: string; card: string; border: string; accent: string };
}

export default function GroupsView({ colors: c }: Props) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [newName, setNewName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState('');

  const load = useCallback(async () => {
    try { setGroups(await api.getGroups()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await api.createGroup(name);
      setNewName('');
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleAddMember = async (groupId: string) => {
    const email = memberEmail.trim();
    if (!email) return;
    try {
      await api.addGroupMember(groupId, email);
      setMemberEmail('');
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleRemoveMember = (groupId: string, userId: string, name?: string) => {
    Alert.alert('Remove Member', `Remove ${name || 'this member'}?`, [
      { text: 'Cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await api.removeGroupMember(groupId, userId); load(); } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const handleDelete = (group: Group) => {
    Alert.alert('Delete Group', `Delete "${group.name}"?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteGroup(group._id); load(); } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const isOwner = (g: Group) => g.ownerId === user?._id;

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.row, { borderColor: c.border }]}>
        <TextInput
          style={[s.input, { borderColor: c.border, color: c.text }]}
          placeholder="New group name"
          placeholderTextColor="#999"
          value={newName}
          onChangeText={setNewName}
        />
        <TouchableOpacity style={[s.addBtn, { backgroundColor: c.accent }]} onPress={handleCreate}>
          <Text style={s.addBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={g => g._id}
        renderItem={({ item: g }) => (
          <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <TouchableOpacity onPress={() => setExpandedId(expandedId === g._id ? null : g._id)}>
              <View style={s.cardHeader}>
                <Text style={[s.groupName, { color: c.text }]}>{g.name}</Text>
                <Text style={s.memberCount}>{g.members.length} 👥</Text>
              </View>
              {isOwner(g) && <Text style={s.ownerBadge}>Owner</Text>}
            </TouchableOpacity>

            {expandedId === g._id && (
              <View style={s.expanded}>
                {g.members.map(m => (
                  <View key={m.userId} style={s.memberRow}>
                    <Text style={[s.memberName, { color: c.text }]}>
                      {m.username || m.name || m.userId.slice(0, 8)}
                    </Text>
                    <Text style={s.memberRole}>{m.role}</Text>
                    {isOwner(g) && m.userId !== user?._id && (
                      <TouchableOpacity onPress={() => handleRemoveMember(g._id, m.userId, m.username)}>
                        <Text style={s.removeBtn}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {isOwner(g) && (
                  <View style={[s.row, { marginTop: 8 }]}>
                    <TextInput
                      style={[s.input, { borderColor: c.border, color: c.text, flex: 1 }]}
                      placeholder="Add by email"
                      placeholderTextColor="#999"
                      value={memberEmail}
                      onChangeText={setMemberEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <TouchableOpacity style={[s.addBtn, { backgroundColor: c.accent }]} onPress={() => handleAddMember(g._id)}>
                      <Text style={s.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isOwner(g) && (
                  <TouchableOpacity onPress={() => handleDelete(g)} style={s.deleteBtn}>
                    <Text style={s.deleteBtnText}>Delete Group</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={[s.empty, { color: c.text }]}>No groups yet</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, flex: 1 },
  addBtn: { borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupName: { fontSize: 16, fontWeight: '600' },
  memberCount: { fontSize: 13, color: '#888' },
  ownerBadge: { fontSize: 11, color: '#1a73e8', marginTop: 2 },
  expanded: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  memberName: { flex: 1, fontSize: 14 },
  memberRole: { fontSize: 12, color: '#888' },
  removeBtn: { color: '#ff3b30', fontSize: 16, paddingHorizontal: 8 },
  deleteBtn: { marginTop: 12, alignItems: 'center', padding: 10 },
  deleteBtnText: { color: '#ff3b30', fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
});
