import { useState, type FormEvent } from 'react';

interface Group {
  _id: string;
  name: string;
}

interface Props {
  groups: Group[];
  onCreate: (title: string, groupIds: string[], deadline?: string, recurrence?: { freq: string; interval: number } | null) => void;
}

export default function TaskForm({ groups, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState('monthly');
  const [interval, setInterval] = useState(1);

  const toggleGroup = (id: string) => {
    setSelectedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const dl = deadline ? new Date(deadline).toISOString() : undefined;
    const rec = recurring && deadline ? { freq, interval } : null;
    onCreate(title.trim(), selectedGroups, dl, rec);
    setTitle('');
    setSelectedGroups([]);
    setDeadline('');
    setRecurring(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24, border: '2px dashed var(--input-border)', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          placeholder="Add a new task..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ flex: 1, padding: 10 }}
        />
        <button type="submit" style={{ padding: '10px 20px' }}>Add</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ padding: 6 }} />
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={recurring} onChange={() => setRecurring(!recurring)} disabled={!deadline} />
          Repeat
        </label>
        {recurring && (
          <>
            <span style={{ fontSize: 13 }}>every</span>
            <input type="number" min={1} value={interval} onChange={e => setInterval(Math.max(1, +e.target.value))} style={{ width: 50, padding: 4 }} />
            <select value={freq} onChange={e => setFreq(e.target.value)} style={{ padding: 4 }}>
              <option value="daily">day(s)</option>
              <option value="weekly">week(s)</option>
              <option value="monthly">month(s)</option>
              <option value="yearly">year(s)</option>
            </select>
          </>
        )}
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
