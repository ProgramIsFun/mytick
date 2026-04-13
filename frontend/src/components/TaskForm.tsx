import { useState, type FormEvent } from 'react';

interface Group {
  _id: string;
  name: string;
}

interface Props {
  groups: Group[];
  onCreate: (title: string, groupIds: string[], deadline?: string, recurrence?: { freq: string; interval: number; until?: string; count?: number } | null) => void;
}

export default function TaskForm({ groups, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState('monthly');
  const [interval, setInterval] = useState(1);
  const [endType, setEndType] = useState<'never' | 'until' | 'count'>('never');
  const [until, setUntil] = useState('');
  const [count, setCount] = useState(10);

  const toggleGroup = (id: string) => {
    setSelectedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const dl = deadline ? new Date(deadline).toISOString() : undefined;
    let rec: any = null;
    if (recurring && deadline) {
      rec = { freq, interval };
      if (endType === 'until' && until) rec.until = new Date(until).toISOString();
      if (endType === 'count') rec.count = count;
    }
    onCreate(title.trim(), selectedGroups, dl, rec);
    setTitle('');
    setSelectedGroups([]);
    setDeadline('');
    setRecurring(false);
    setEndType('never');
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
      {recurring && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
          <span>Ends:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <input type="radio" name="endType" checked={endType === 'never'} onChange={() => setEndType('never')} /> Never
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <input type="radio" name="endType" checked={endType === 'until'} onChange={() => setEndType('until')} /> On date
          </label>
          {endType === 'until' && (
            <input type="date" value={until} onChange={e => setUntil(e.target.value)} style={{ padding: 4 }} />
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <input type="radio" name="endType" checked={endType === 'count'} onChange={() => setEndType('count')} /> After
          </label>
          {endType === 'count' && (
            <>
              <input type="number" min={1} value={count} onChange={e => setCount(Math.max(1, +e.target.value))} style={{ width: 50, padding: 4 }} />
              <span>times</span>
            </>
          )}
        </div>
      )}
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
