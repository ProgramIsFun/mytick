import { useState, type FormEvent } from 'react';

interface Group {
  _id: string;
  name: string;
}

interface Props {
  groups: Group[];
  onCreate: (title: string, groupIds: string[]) => void;
}

export default function TaskForm({ groups, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const toggleGroup = (id: string) => {
    setSelectedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim(), selectedGroups);
    setTitle('');
    setSelectedGroups([]);
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24, border: '2px dashed #ccc', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          placeholder="Add a new task..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ flex: 1, padding: 10 }}
        />
        <button type="submit" style={{ padding: '10px 20px' }}>Add</button>
      </div>
      {groups.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {groups.map(g => (
            <label key={g._id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={selectedGroups.includes(g._id)} onChange={() => toggleGroup(g._id)} />
              {g.name}
            </label>
          ))}
        </div>
      )}
    </form>
  );
}
