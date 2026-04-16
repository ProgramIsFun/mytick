import { useState, type FormEvent } from 'react';

interface Group { _id: string; name: string; }

interface Props {
  groups: Group[];
  onCreate: (title: string, groupIds: string[], deadline?: string, recurrence?: { freq: string; interval: number; until?: string; count?: number } | null) => void;
}

const inputCls = "w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors";
const btnSecondary = "px-4 py-2 text-sm rounded-md border border-border text-text-secondary hover:bg-surface-hover transition-colors";
const btnPrimary = "px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors";

export default function TaskForm({ groups, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState('monthly');
  const [interval, setInterval] = useState(1);
  const [endType, setEndType] = useState<'never' | 'until' | 'count'>('never');
  const [until, setUntil] = useState('');
  const [count, setCount] = useState(10);

  const toggleGroup = (id: string) => setSelectedGroups(p => p.includes(id) ? p.filter(g => g !== id) : [...p, id]);

  const reset = () => {
    setTitle(''); setSelectedGroups([]); setDeadline('');
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
    reset(); setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 text-sm border-2 border-dashed border-border rounded-lg bg-transparent text-text-muted hover:border-accent hover:text-accent cursor-pointer transition-colors"
      >
        + Add a new task...
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
          <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} className="bg-surface border border-border rounded-xl w-[90%] max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary mb-4">New Task</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus className={inputCls} />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Deadline</label>
                <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
              </div>

              <div className="p-3 bg-surface-secondary rounded-lg">
                <label className="text-xs font-medium text-text-secondary flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={recurring} onChange={() => setRecurring(!recurring)} disabled={!deadline} className="rounded border-border accent-accent" />
                  Repeat this task
                </label>
                {recurring && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-text-secondary">Every</span>
                      <input type="number" min={1} value={interval} onChange={e => setInterval(Math.max(1, +e.target.value))} className="w-14 px-2 py-1 text-sm rounded border border-border bg-surface" />
                      <select value={freq} onChange={e => setFreq(e.target.value)} className="px-2 py-1 text-sm rounded border border-border bg-surface">
                        <option value="daily">day(s)</option>
                        <option value="weekly">week(s)</option>
                        <option value="monthly">month(s)</option>
                        <option value="yearly">year(s)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-text-secondary">
                      <span>Ends:</span>
                      <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="endType" checked={endType === 'never'} onChange={() => setEndType('never')} /> Never</label>
                      <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="endType" checked={endType === 'until'} onChange={() => setEndType('until')} /> On</label>
                      {endType === 'until' && <input type="date" value={until} onChange={e => setUntil(e.target.value)} className="px-2 py-1 rounded border border-border bg-surface text-xs" />}
                      <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="endType" checked={endType === 'count'} onChange={() => setEndType('count')} /> After</label>
                      {endType === 'count' && <><input type="number" min={1} value={count} onChange={e => setCount(Math.max(1, +e.target.value))} className="w-14 px-2 py-1 rounded border border-border bg-surface text-xs" /><span>times</span></>}
                    </div>
                  </div>
                )}
              </div>

              {groups.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-2 block">Share with groups</label>
                  <div className="flex flex-wrap gap-2">
                    {groups.map(g => (
                      <label key={g._id} className={`text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors ${selectedGroups.includes(g._id) ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:bg-surface-hover'}`}>
                        <input type="checkbox" checked={selectedGroups.includes(g._id)} onChange={() => toggleGroup(g._id)} className="hidden" />
                        {g.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => { reset(); setOpen(false); }} className={btnSecondary}>Cancel</button>
              <button type="submit" className={btnPrimary}>Create Task</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
