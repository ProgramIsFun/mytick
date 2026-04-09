import { useState, type FormEvent } from 'react';

interface Props {
  onCreate: (title: string) => void;
}

export default function TaskForm({ onCreate }: Props) {
  const [title, setTitle] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim());
    setTitle('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      <input
        placeholder="Add a new task..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{ flex: 1, padding: 10 }}
      />
      <button type="submit" style={{ padding: '10px 20px' }}>Add</button>
    </form>
  );
}
