import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Task {
  _id: string;
  title: string;
  status: string;
  deadline: string | null;
}

interface Props {
  tasks: Task[];
}

export default function CalendarView({ tasks }: Props) {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = month.getFullYear();
  const mon = month.getMonth();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const startDay = new Date(year, mon, 1).getDay();

  const tasksByDate = new Map<string, Task[]>();
  tasks.filter(t => t.deadline).forEach(t => {
    const d = new Date(t.deadline!);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!tasksByDate.has(key)) tasksByDate.set(key, []);
    tasksByDate.get(key)!.push(t);
  });

  const prev = () => setMonth(new Date(year, mon - 1, 1));
  const next = () => setMonth(new Date(year, mon + 1, 1));

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${mon}-${d}`;
    const dayTasks = tasksByDate.get(key) || [];
    const isToday = new Date().toDateString() === new Date(year, mon, d).toDateString();
    cells.push(
      <div key={d} style={{ border: '1px solid #eee', minHeight: 70, padding: 4, background: isToday ? '#f0f7ff' : 'white' }}>
        <div style={{ fontSize: 12, fontWeight: isToday ? 'bold' : 'normal', color: isToday ? '#1a73e8' : '#666' }}>{d}</div>
        {dayTasks.map(t => (
          <div key={t._id} onClick={() => navigate(`/tasks/${t._id}`)}
            style={{ fontSize: 11, padding: '2px 4px', margin: '1px 0', borderRadius: 3, cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              background: t.status === 'done' ? '#e8f5e9' : '#fff3e0', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
            {t.title}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={prev}>← Prev</button>
        <strong>{month.toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>
        <button onClick={next}>Next →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, fontSize: 13 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', padding: 4, color: '#888' }}>{d}</div>
        ))}
        {cells}
      </div>
    </div>
  );
}
