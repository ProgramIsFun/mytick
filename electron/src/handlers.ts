import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface SystemInfo {
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

interface OsDeps {
  platform: () => string;
  arch: () => string;
  hostname: () => string;
  type: () => string;
  release: () => string;
  cpus: () => Array<{ model: string }>;
  totalmem: () => number;
  freemem: () => number;
  uptime: () => number;
  homedir: () => string;
  tmpdir: () => string;
}

export function getSystemInfo(osDeps: OsDeps = os): SystemInfo {
  const cpus = osDeps.cpus();
  return {
    platform: osDeps.platform(),
    arch: osDeps.arch(),
    hostname: osDeps.hostname(),
    osType: osDeps.type(),
    osRelease: osDeps.release(),
    cpuModel: cpus.length > 0 ? cpus[0].model : 'unknown',
    cpuCores: cpus.length,
    totalMemoryMB: Math.round(osDeps.totalmem() / 1024 / 1024),
    freeMemoryMB: Math.round(osDeps.freemem() / 1024 / 1024),
    uptimeHours: Math.round(osDeps.uptime() / 3600 * 10) / 10,
    homeDir: osDeps.homedir(),
    tmpDir: osDeps.tmpdir(),
  };
}

export async function handleEnvWrite(
  { filePath, content }: { filePath: string; content: string },
  deps: { existsSync: typeof fs.existsSync; mkdirSync: typeof fs.mkdirSync; writeFileSync: typeof fs.writeFileSync } = fs
): Promise<{ success: boolean; error?: string }> {
  try {
    const dir = path.dirname(filePath);
    if (!deps.existsSync(dir)) {
      deps.mkdirSync(dir, { recursive: true });
    }
    deps.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function handleEnvSelectDirectory(
  dialog: { showOpenDialog: (...args: unknown[]) => Promise<{ canceled: boolean; filePaths: string[] }> }
): Promise<{ path: string } | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return { path: result.filePaths[0] };
}
