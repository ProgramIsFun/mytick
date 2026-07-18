interface ElectronAPI {
  writeEnvFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: () => Promise<{ path: string } | null>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
