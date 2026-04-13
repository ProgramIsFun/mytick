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
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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

  const reset = () => {
    setTitle(''); setDescription(''); setSelectedGroups([]); setDeadline('');
    setRecurring(false); setFreq('monthly'); setInterval(1);
    setEndType('never'); setUntil(''); setCount(10);
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
    reset();
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ width: '100%', padding: 12, marginBottom: 24, fontSize: 15, border: '2px dashed var(--input-border)', borderRadius: 8, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
        + Add a new task...
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setOpen(false)}>
          <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', padding: 24, borderRadius: 12, width: '90%', maxWidth: 440, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px' }}>New Task</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus style={{ width: '100%', padding: 10, boxSizing: 'border-box', borderRadius: 6, border: '1px solid var(--input-border)' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional details..." rows={2} style={{ width: '100%', padding: 10, boxSizing: 'border-box', borderRadius: 6, border: '1px solid var(--input-border)', resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Deadline</label>
              <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ width: '100%', padding: 10, boxSizing: 'border-box', borderRadius: 6, border: '1px solid var(--input-border)' }} />
            </div>

            <div style={{ marginBottom: 12, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: recurring ? 10 : 0 }}>
                <input type="checkbox" checked={recurring} onChange={() => setRecurring(!recurring)} disabled={!deadline} />
                Repeat this task
              </label>
              {recurring && (
                <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13 }}>Every</span>
                    <input type="number" min={1} value={interval} onChange={e => setInterval(Math.max(1, +e.target.value))} style={{ width: 50, padding: 6, borderRadius: 4, border: '1px solid var(--input-border)' }} />
                    <select value={freq} onChange={e => setFreq(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid var(--input-border)' }}>
                      <option value="daily">day(s)</option>
                      <option value="weekly">week(s)</option>
                      <option value="monthly">month(s)</option>
                      <option value="yearly">year(s)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                    <span>Ends:</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input type="radio" name="endType" checked={endType === 'never'} onChange={() => setEndType('never')} /> Never
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input type="radio" name="endType" checked={endType === 'until'} onChange={() => setEndType('until')} /> On
                    </label>
                    {endType === 'until' && (
                      <input type="date" value={until} onChange={e => setUntil(e.target.value)} style={{ padding: 4, borderRadius: 4, border: '1px solid var(--input-border)' }} />
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input type="radio" name="endType" checked={endType === 'count'} onChange={() => setEndType('count')} /> After
                    </label>
                    {endType === 'count' && (
                      <>
                        <input type="number" min={1} value={count} onChange={e => setCount(Math.max(1, +e.target.value))} style={{ width: 50, padding: 4, borderRadius: 4, border: '1px solid var(--input-border)' }} />
                        <span>times</span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {groups.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Share with groups</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {groups.map(g => (
                    <label key={g._id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, background: selectedGroups.includes(g._id) ? 'var(--task-pending)' : 'transparent', border: '1px solid var(--input-border)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedGroups.includes(g._id)} onChange={() => toggleGroup(g._id)} />
                      {g.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { reset(); setOpen(false); }} style={{ padding: '10px 20px', borderRadius: 6 }}>Cancel</button>
              <button type="submit" style={{ padding: '10px 20px', borderRadius: 6, fontWeight: 'bold' }}>Create Task</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
