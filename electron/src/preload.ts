import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  writeEnvFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('env:write', { filePath, content }),
  selectDirectory: () => ipcRenderer.invoke('env:selectDirectory'),
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  scanForRepos: (path: string) => ipcRenderer.invoke('computer:scan', path),
  readMapping: () => ipcRenderer.invoke('computer:readMapping'),
  writeMapping: (mapping: Record<string, { repoId: string; repoName: string }>) =>
    ipcRenderer.invoke('computer:writeMapping', mapping),
});
