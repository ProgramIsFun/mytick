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

interface ScannedRepo {
  name: string;
  path: string;
  remoteUrl: string;
}

interface RepoMapping {
  [folderPath: string]: { repoId: string; repoName: string };
}

interface ElectronAPI {
  writeEnvFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: () => Promise<{ path: string } | null>;
  getSystemInfo: () => Promise<SystemInfo>;
  scanForRepos: (path: string) => Promise<ScannedRepo[]>;
  readMapping: () => Promise<RepoMapping>;
  writeMapping: (mapping: RepoMapping) => Promise<void>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
