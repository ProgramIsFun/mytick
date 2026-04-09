import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Member {
  userId: string;
  role: string;
}

interface Group {
  _id: string;
  name: string;
  ownerId: string;
  members: Member[];
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('viewer');
  const [error, setError] = useState('');
  const { user } = useAuth();

  const load = async () => {
    try { setGroups(await api.getGroups()); } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createGroup(name.trim());
    setName('');
    load();
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!addMemberGroupId || !memberUserId.trim()) return;
    try {
      await api.addMember(addMemberGroupId, memberUserId.trim(), memberRole);
      setMemberUserId('');
      setAddMemberGroupId(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    await api.removeMember(groupId, userId);
    load();
  };

  const handleDelete = async (groupId: string) => {
    await api.deleteGroup(groupId);
    load();
  };

  return (
    <div>
      <h2>Groups</h2>

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          placeholder="New group name..."
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ flex: 1, padding: 10 }}
        />
        <button type="submit" style={{ padding: '10px 20px' }}>Create</button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {groups.map(group => {
        const isOwner = group.ownerId === user?.id;
        return (
        <div key={group._id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{group.name}</strong>
            {isOwner && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAddMemberGroupId(addMemberGroupId === group._id ? null : group._id)} style={{ fontSize: 12, padding: '4px 8px' }}>
                + Member
              </button>
              <button onClick={() => handleDelete(group._id)} style={{ fontSize: 12, padding: '4px 8px', color: 'red' }}>
                Delete
              </button>
            </div>
            )}
          </div>

          <div style={{ marginTop: 8 }}>
            {group.members.map(m => (
              <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 14 }}>
                <span>{m.userId} ({m.role})</span>
                {isOwner && (
                <button onClick={() => handleRemoveMember(group._id, m.userId)} style={{ fontSize: 11, padding: '2px 6px', color: 'red' }}>
                  Remove
                </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && addMemberGroupId === group._id && (
            <form onSubmit={handleAddMember} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                placeholder="User ID"
                value={memberUserId}
                onChange={e => setMemberUserId(e.target.value)}
                style={{ flex: 1, padding: 6 }}
              />
              <select value={memberRole} onChange={e => setMemberRole(e.target.value)} style={{ padding: 6 }}>
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button type="submit" style={{ padding: '6px 12px' }}>Add</button>
            </form>
          )}
        </div>
        );
      })}
    </div>
  );
}
