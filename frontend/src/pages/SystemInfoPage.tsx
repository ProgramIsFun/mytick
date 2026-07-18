import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import { api } from '../api/client';
import type { Repo } from '../types/repo';
import type { RepoEnvFilesRawResponse } from '../types/computer';

interface MatchedRepo {
  name: string;
  folderPath: string;
  remoteUrl: string;
  repoId: string;
  repoUrl: string;
}

export default function SystemInfoPage() {
  const navigate = useNavigate();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [matchedRepos, setMatchedRepos] = useState<MatchedRepo[]>([]);
  const [mapping, setMapping] = useState<RepoMapping>({});
  const [reconstructing, setReconstructing] = useState<string | null>(null);
  const [reconstructResult, setReconstructResult] = useState<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI) {
      setError('This page is only available in the Electron app.');
      return;
    }
    window.electronAPI.getSystemInfo().then(setInfo).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to get system info');
    });
    window.electronAPI.readMapping().then((m) => {
      setMapping(m);
      const entries = Object.entries(m);
      if (entries.length > 0) {
        setMatchedRepos(entries.map(([folderPath, v]) => ({
          name: v.repoName,
          folderPath,
          remoteUrl: '',
          repoId: v.repoId,
          repoUrl: '',
        })));
      }
    });
  }, []);

  const handleScan = async () => {
    if (!window.electronAPI) return;
    const dir = await window.electronAPI.selectDirectory();
    if (!dir) return;

    setScanning(true);
    setError('');
    setReconstructResult(null);
    try {
      const scanned = await window.electronAPI.scanForRepos(dir.path);
      if (scanned.length === 0) {
        setError('No git repositories found in this directory.');
        setScanning(false);
        return;
      }

      const repos: Repo[] = await api.getRepos();
      const matched: MatchedRepo[] = [];
      const newMapping: RepoMapping = { ...mapping };

      for (const s of scanned) {
        const normalizedUrl = s.remoteUrl.replace(/\.git$/, '').replace(/\/$/, '');
        const found = repos.find((r: Repo) => {
          const normalizedRepoUrl = r.url.replace(/\.git$/, '').replace(/\/$/, '');
          return normalizedUrl === normalizedRepoUrl || normalizedUrl.endsWith('/' + r.id);
        });

        if (found) {
          matched.push({
            name: s.name,
            folderPath: s.path,
            remoteUrl: s.remoteUrl,
            repoId: found.id,
            repoUrl: found.url,
          });
          newMapping[s.path] = { repoId: found.id, repoName: s.name };
        }
      }

      setMatchedRepos(matched);
      setMapping(newMapping);
      await window.electronAPI.writeMapping(newMapping);

      if (matched.length === 0) {
        setError(`Found ${scanned.length} repos, but none match repos in MyTick.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleReconstruct = async (repoId: string, repoName: string) => {
    setReconstructing(repoId);
    setReconstructResult(null);
    setError('');
    try {
      const result: RepoEnvFilesRawResponse = await api.getRepoEnvFilesRaw(repoId);

      if (result.files.length === 0) {
        setReconstructResult(`${repoName}: No env files configured.`);
        return;
      }

      const entry = Object.entries(mapping).find(([, v]) => v.repoId === repoId);
      if (!entry) {
        setError(`No folder mapping found for ${repoName}`);
        return;
      }

      const [folderPath] = entry;
      let written = 0;

      for (const file of result.files) {
        const fullPath = `${folderPath}/${file.path}`.replace(/\\/g, '/');
        const res = await window.electronAPI!.writeEnvFile(fullPath, file.content);
        if (res.success) written++;
      }

      setReconstructResult(`✅ ${repoName}: Written ${written}/${result.files.length} env file(s)`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reconstruct failed');
    } finally {
      setReconstructing(null);
    }
  };

  const handleReconstructAll = async () => {
    setReconstructResult(null);
    setError('');
    let total = 0;
    let success = 0;

    for (const repo of matchedRepos) {
      total++;
      try {
        const result: RepoEnvFilesRawResponse = await api.getRepoEnvFilesRaw(repo.repoId);
        const entry = Object.entries(mapping).find(([, v]) => v.repoId === repo.repoId);
        if (!entry || result.files.length === 0) continue;

        const [folderPath] = entry;
        let allWritten = true;
        for (const file of result.files) {
          const fullPath = `${folderPath}/${file.path}`.replace(/\\/g, '/');
          const res = await window.electronAPI!.writeEnvFile(fullPath, file.content);
          if (!res.success) allWritten = false;
        }
        if (allWritten) success++;
      } catch {
        // skip failed repos
      }
    }

    setReconstructResult(`✅ Reconstructed ${success}/${total} repos`);
  };

  const sections = [
    {
      title: 'Machine',
      rows: [
        { label: 'Machine ID', value: info!.machineId },
      ],
    },
    {
      title: 'Operating System',
      rows: [
        { label: 'Type', value: info!.osType },
        { label: 'Release', value: info!.osRelease },
        { label: 'Platform', value: info!.platform },
        { label: 'Architecture', value: info!.arch },
      ],
    },
    {
      title: 'Hardware',
      rows: [
        { label: 'CPU', value: info!.cpuModel },
        { label: 'CPU Cores', value: String(info!.cpuCores) },
        { label: 'Total Memory', value: `${info!.totalMemoryMB} MB` },
        { label: 'Free Memory', value: `${info!.freeMemoryMB} MB` },
      ],
    },
    {
      title: 'Environment',
      rows: [
        { label: 'Hostname', value: info!.hostname },
        { label: 'Home Directory', value: info!.homeDir },
        { label: 'Temp Directory', value: info!.tmpDir },
        { label: 'Uptime', value: `${info!.uptimeHours} hours` },
      ],
    },
  ];

  if (error && !info) {
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

        <div className="border border-border rounded-lg bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">📦 Project Repos</h2>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {scanning ? 'Scanning...' : '🔍 Scan Projects'}
            </button>
          </div>

          {scanning && <Spinner text="Scanning directories for git repos..." />}

          {error && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-600">{error}</div>
          )}

          {reconstructResult && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-600">{reconstructResult}</div>
          )}

          {matchedRepos.length > 0 && !scanning && (
            <>
              <div className="flex justify-end">
                <button
                  onClick={handleReconstructAll}
                  disabled={reconstructing !== null}
                  className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  🔄 Reconstruct All
                </button>
              </div>
              <div className="space-y-2">
                {matchedRepos.map(repo => (
                  <div key={repo.repoId || repo.folderPath} className="flex items-center justify-between p-3 rounded-md bg-surface-secondary border border-border">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">{repo.name}</div>
                      <div className="text-xs text-text-muted font-mono truncate">{repo.folderPath}</div>
                    </div>
                    <button
                      onClick={() => handleReconstruct(repo.repoId, repo.name)}
                      disabled={reconstructing !== null}
                      className="ml-3 px-3 py-1 text-xs rounded-md border border-border hover:bg-surface-hover disabled:opacity-50 transition-colors shrink-0"
                    >
                      {reconstructing === repo.repoId ? 'Writing...' : '📝 Reconstruct'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {!scanning && matchedRepos.length === 0 && !error && (
            <p className="text-sm text-text-muted text-center py-4">
              Click "Scan Projects" to find git repositories on this machine.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
