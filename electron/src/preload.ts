import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  writeEnvFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('env:write', { filePath, content }),
  selectDirectory: () => ipcRenderer.invoke('env:selectDirectory'),
});
