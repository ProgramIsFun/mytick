import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface CalendarItem {
  _id?: string;
  taskId: string;
  title: string;
  status: string;
  date: string;
  recurring: boolean;
}

interface EditState {
  taskId: string;
  originalDate: string;
  newDate: string;
  title: string;
}

export default function CalendarView() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [menu, setMenu] = useState<{ taskId: string; date: string } | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const year = month.getFullYear();
  const mon = month.getMonth();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const startDay = new Date(year, mon, 1).getDay();

  const refresh = async () => {
    const from = new Date(year, mon, 1).toISOString();
    const to = new Date(year, mon + 1, 0, 23, 59, 59).toISOString();
    setItems(await api.getCalendar(from, to).catch(() => []));
  };

  useEffect(() => { refresh(); }, [year, mon]);

  const toggleOccurrence = async (item: CalendarItem) => {
    if (item.recurring) {
      if (item.status === 'done') await api.revertOccurrence(item.taskId, item.date);
      else await api.markOccurrence(item.taskId, item.date, 'done');
    } else {
      await api.updateTask(item.taskId, { status: item.status === 'done' ? 'pending' : 'done' });
    }
    refresh();
  };

  const handleEndSeries = async (taskId: string, date: string) => {
    await api.endSeries(taskId, date);
    setMenu(null);
    refresh();
  };

  const handleSkip = async (taskId: string, date: string) => {
    await api.markOccurrence(taskId, date, 'skipped');
    setMenu(null);
    refresh();
  };

  const openEdit = (item: CalendarItem) => {
    const d = new Date(item.date);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEdit({ taskId: item.taskId, originalDate: item.date, newDate: local, title: item.title });
    setMenu(null);
  };

  const saveEdit = async () => {
    if (!edit) return;
    await api.editOccurrence(edit.taskId, edit.originalDate, {
      newDate: new Date(edit.newDate).toISOString(),
      title: edit.title,
    });
    setEdit(null);
    refresh();
  };

  const itemsByDate = new Map<string, CalendarItem[]>();
  items.forEach(item => {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!itemsByDate.has(key)) itemsByDate.set(key, []);
    itemsByDate.get(key)!.push(item);
  });

  const prev = () => setMonth(new Date(year, mon - 1, 1));
  const next = () => setMonth(new Date(year, mon + 1, 1));

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${mon}-${d}`;
    const dayItems = itemsByDate.get(key) || [];
    const isToday = new Date().toDateString() === new Date(year, mon, d).toDateString();
    cells.push(
      <div key={d} style={{ border: '1px solid var(--border)', minHeight: 70, padding: 4, background: isToday ? 'var(--today-bg)' : 'var(--btn-bg)', position: 'relative' }}>
        <div style={{ fontSize: 12, fontWeight: isToday ? 'bold' : 'normal', color: isToday ? 'var(--link)' : 'var(--text-secondary)' }}>{d}</div>
        {dayItems.map((item, i) => {
          const isMenuOpen = menu?.taskId === item.taskId && menu?.date === item.date;
          return (
            <div key={`${item.taskId}-${i}`} style={{ fontSize: 11, padding: '2px 4px', margin: '1px 0', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 3, overflow: 'visible', position: 'relative',
              background: item.status === 'done' ? 'var(--task-done)' : 'var(--task-pending)', textDecoration: item.status === 'done' ? 'line-through' : 'none' }}>
              <input type="checkbox" checked={item.status === 'done'} onChange={() => toggleOccurrence(item)} style={{ margin: 0, cursor: 'pointer' }} />
              <span onClick={() => navigate(`/tasks/${item.taskId}`)} style={{ cursor: 'pointer', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', flex: 1 }}>
                {item.recurring ? '🔁 ' : ''}{item.title}
              </span>
              {item.recurring && (
                <span onClick={(e) => { e.stopPropagation(); setMenu(isMenuOpen ? null : { taskId: item.taskId, date: item.date }); }} style={{ cursor: 'pointer', fontSize: 10 }}>⋯</span>
              )}
              {isMenuOpen && (
                <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: 4, zIndex: 10, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  <div onClick={() => openEdit(item)} style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>✏️ Edit this one</div>
                  <div onClick={() => handleSkip(item.taskId, item.date)} style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>⏭ Skip this one</div>
                  <div onClick={() => handleEndSeries(item.taskId, item.date)} style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: 'var(--danger)' }}>🛑 End series from here</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div onClick={() => { if (menu) setMenu(null); }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={prev}>← Prev</button>
        <strong>{month.toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>
        <button onClick={next}>Next →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, fontSize: 13 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', padding: 4, color: 'var(--text-muted)' }}>{d}</div>
        ))}
        {cells}
      </div>

      {edit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setEdit(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', padding: 24, borderRadius: 8, minWidth: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px' }}>Edit this occurrence</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Title</label>
              <input value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Date & time</label>
              <input type="datetime-local" value={edit.newDate} onChange={e => setEdit({ ...edit, newDate: e.target.value })} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEdit(null)}>Cancel</button>
              <button onClick={saveEdit} style={{ fontWeight: 'bold' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
