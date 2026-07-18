interface SystemInfo {
  machineId: string;
  platform: string;
  arch: string;
  hostname: string;
  osType: string;
  osRelease: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryMB: number;
  freeMemoryMB: number;
  uptimeHours: number;
  homeDir: string;
  tmpDir: string;
}

interface ElectronAPI {
  writeEnvFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: () => Promise<{ path: string } | null>;
  getSystemInfo: () => Promise<SystemInfo>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
