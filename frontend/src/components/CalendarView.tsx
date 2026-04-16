import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface CalendarItem { _id?: string; taskId: string; title: string; status: string; date: string; recurring: boolean; }
interface EditState { taskId: string; originalDate: string; newDate: string; title: string; }

const inputCls = "w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors";

export default function CalendarView() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [menu, setMenu] = useState<{ taskId: string; date: string } | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ date: string; title: string } | null>(null);

  const year = month.getFullYear(), mon = month.getMonth();
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

  const openEdit = (item: CalendarItem) => {
    const d = new Date(item.date);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEdit({ taskId: item.taskId, originalDate: item.date, newDate: local, title: item.title });
    setMenu(null);
  };

  const saveEdit = async () => {
    if (!edit) return;
    await api.editOccurrence(edit.taskId, edit.originalDate, { newDate: new Date(edit.newDate).toISOString(), title: edit.title });
    setEdit(null); refresh();
  };

  const itemsByDate = new Map<string, CalendarItem[]>();
  items.forEach(item => {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!itemsByDate.has(key)) itemsByDate.set(key, []);
    itemsByDate.get(key)!.push(item);
  });

  const handleQuickAdd = async () => {
    if (!quickAdd || !quickAdd.title.trim()) { setQuickAdd(null); return; }
    await api.createTask({ title: quickAdd.title.trim(), deadline: new Date(quickAdd.date).toISOString() });
    setQuickAdd(null); refresh();
  };

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(<div key={`e${i}`} className="min-h-[80px]" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${mon}-${d}`;
    const dayItems = itemsByDate.get(key) || [];
    const isToday = new Date().toDateString() === new Date(year, mon, d).toDateString();
    const dateStr = new Date(year, mon, d, 12).toISOString();
    cells.push(
      <div key={d} className={`border border-border-light min-h-[80px] p-1.5 rounded-md relative cursor-pointer ${isToday ? 'bg-accent/5' : 'bg-surface hover:bg-surface-hover'}`}
        onClick={() => setQuickAdd({ date: dateStr, title: '' })}>
        <div className={`text-xs mb-1 ${isToday ? 'font-bold text-accent' : 'text-text-muted'}`}>{d}</div>
        {dayItems.map((item, i) => {
          const isMenuOpen = menu?.taskId === item.taskId && menu?.date === item.date;
          return (
            <div key={`${item.taskId}-${i}`}
              className={`text-[11px] px-1.5 py-1 my-0.5 rounded flex items-center gap-1.5 relative ${item.status === 'done' ? 'bg-success/10 line-through text-text-muted' : 'bg-warning/10 text-text-primary'}`}>
              <input type="checkbox" checked={item.status === 'done'} onChange={() => toggleOccurrence(item)} className="w-3 h-3 cursor-pointer accent-accent" />
              <span onClick={() => navigate(`/tasks/${item.taskId}`)} className="cursor-pointer truncate flex-1">
                {item.recurring ? '🔁 ' : ''}{item.title}
              </span>
              {item.recurring && (
                <span onClick={e => { e.stopPropagation(); setMenu(isMenuOpen ? null : { taskId: item.taskId, date: item.date }); }} className="cursor-pointer text-[10px] hover:bg-surface-hover rounded px-0.5">⋯</span>
              )}
              {isMenuOpen && (
                <div onClick={e => e.stopPropagation()} className="absolute right-0 top-full bg-surface border border-border rounded-md p-1 z-10 shadow-lg whitespace-nowrap">
                  <div onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs cursor-pointer hover:bg-surface-hover rounded">✏️ Edit this one</div>
                  <div onClick={() => { api.markOccurrence(item.taskId, item.date, 'skipped'); setMenu(null); refresh(); }} className="px-3 py-1.5 text-xs cursor-pointer hover:bg-surface-hover rounded">⏭ Skip this one</div>
                  <div onClick={() => { api.endSeries(item.taskId, item.date); setMenu(null); refresh(); }} className="px-3 py-1.5 text-xs cursor-pointer hover:bg-surface-hover rounded text-danger">🛑 End series</div>
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
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth(new Date(year, mon - 1, 1))} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-hover transition-colors">← Prev</button>
        <span className="text-sm font-semibold text-text-primary">{month.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setMonth(new Date(year, mon + 1, 1))} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-hover transition-colors">Next →</button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-text-muted py-2">{d}</div>
        ))}
        {cells}
      </div>

      {quickAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setQuickAdd(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-surface border border-border rounded-xl p-6 min-w-[320px] shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary mb-1">New task</h3>
            <p className="text-xs text-text-muted mb-4">{new Date(quickAdd.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <input
              value={quickAdd.title} onChange={e => setQuickAdd({ ...quickAdd, title: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') setQuickAdd(null); }}
              placeholder="Task title..." autoFocus className={inputCls} />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setQuickAdd(null)} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-surface-hover transition-colors">Cancel</button>
              <button onClick={handleQuickAdd} className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEdit(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-surface border border-border rounded-xl p-6 min-w-[320px] shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Edit occurrence</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Title</label>
                <input value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Date & time</label>
                <input type="datetime-local" value={edit.newDate} onChange={e => setEdit({ ...edit, newDate: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEdit(null)} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-surface-hover transition-colors">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
