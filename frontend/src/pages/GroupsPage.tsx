import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Group } from '../types/group';
import { inputClsFull as inputCls } from '../constants/styles';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('viewer');
  const [error, setError] = useState('');
  const { user } = useAuth();

  const load = async () => { try { setGroups(await api.getGroups()); } catch (e: any) { setError(e.message); } };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createGroup(name.trim()); setName(''); load();
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!addMemberGroupId || !memberUserId.trim()) return;
    try { await api.addMember(addMemberGroupId, memberUserId.trim(), memberRole); setMemberUserId(''); setAddMemberGroupId(null); load(); }
    catch (e: any) { setError(e.message); }
  };

  return (
    <div>
      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input placeholder="New group name..." value={name} onChange={e => setName(e.target.value)} className={`flex-1 ${inputCls}`} />
        <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors">Create</button>
      </form>

      {error && <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md mb-4">{error}</div>}

      <div className="space-y-3">
        {groups.map(group => {
          const isOwner = group.ownerId === user?.id;
          return (
            <div key={group._id} className="border border-border rounded-lg p-4 bg-surface">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">👥 {group.name}</h3>
                {isOwner && (
                  <div className="flex gap-2">
                    <button onClick={() => setAddMemberGroupId(addMemberGroupId === group._id ? null : group._id)}
                      className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-surface-hover transition-colors">+ Member</button>
                    <button onClick={() => { api.deleteGroup(group._id); load(); }}
                      className="text-xs px-2.5 py-1 rounded-md text-danger hover:bg-danger/10 transition-colors">Delete</button>
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-1">
                {group.members.map(m => (
                  <div key={m.userId} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-surface-secondary text-sm">
                    <span className="text-text-primary">@{m.username || m.userId} <span className="text-text-muted">· {m.role}</span></span>
                    {isOwner && (
                      <button onClick={() => { api.removeMember(group._id, m.userId); load(); }}
                        className="text-[11px] text-danger hover:underline">Remove</button>
                    )}
                  </div>
                ))}
                {group.members.length === 0 && <p className="text-xs text-text-muted py-1">No members yet</p>}
              </div>

              {isOwner && addMemberGroupId === group._id && (
                <form onSubmit={handleAddMember} className="flex gap-2 mt-3">
                  <input placeholder="User ID or email" value={memberUserId} onChange={e => setMemberUserId(e.target.value)} className={`flex-1 ${inputCls}`} />
                  <select value={memberRole} onChange={e => setMemberRole(e.target.value)} className={inputCls}>
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button type="submit" className="px-3 py-2 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors">Add</button>
                </form>
              )}
            </div>
          );
        })}
        {groups.length === 0 && <div className="text-center py-8 text-text-muted text-sm">No groups yet. Create one above!</div>}
      </div>
    </div>
  );
}
