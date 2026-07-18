import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';

export default function SystemInfoPage() {
  const navigate = useNavigate();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!window.electronAPI) {
      setError('This page is only available in the Electron app.');
      return;
    }
    window.electronAPI.getSystemInfo().then(setInfo).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to get system info');
    });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-surface">
        <header className="border-b border-border bg-surface-secondary">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-sm text-text-muted hover:text-text-primary">← Back</button>
            <h1 className="text-lg font-semibold text-text-primary">💻 System Info</h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-500">{error}</div>
        </main>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-surface">
        <header className="border-b border-border bg-surface-secondary">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-sm text-text-muted hover:text-text-primary">← Back</button>
            <h1 className="text-lg font-semibold text-text-primary">💻 System Info</h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">
          <Spinner text="Loading system info..." />
        </main>
      </div>
    );
  }

  const sections = [
    {
      title: 'Operating System',
      rows: [
        { label: 'Type', value: info.osType },
        { label: 'Release', value: info.osRelease },
        { label: 'Platform', value: info.platform },
        { label: 'Architecture', value: info.arch },
      ],
    },
    {
      title: 'Hardware',
      rows: [
        { label: 'CPU', value: info.cpuModel },
        { label: 'CPU Cores', value: String(info.cpuCores) },
        { label: 'Total Memory', value: `${info.totalMemoryMB} MB` },
        { label: 'Free Memory', value: `${info.freeMemoryMB} MB` },
      ],
    },
    {
      title: 'Environment',
      rows: [
        { label: 'Hostname', value: info.hostname },
        { label: 'Home Directory', value: info.homeDir },
        { label: 'Temp Directory', value: info.tmpDir },
        { label: 'Uptime', value: `${info.uptimeHours} hours` },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-sm text-text-muted hover:text-text-primary">← Back</button>
          <h1 className="text-lg font-semibold text-text-primary">💻 System Info</h1>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {sections.map(section => (
          <div key={section.title} className="border border-border rounded-lg bg-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">{section.title}</h2>
            <div className="space-y-2">
              {section.rows.map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">{row.label}</span>
                  <span className="text-sm text-text-primary font-mono">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
