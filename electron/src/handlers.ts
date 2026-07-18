import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { machineIdSync } from 'node-machine-id';
import { execFileSync } from 'child_process';

export interface SystemInfo {
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

  export function getSystemInfo(osDeps: OsDeps = os, getMachineId: () => string = () => machineIdSync(true)): SystemInfo {
  const cpus = osDeps.cpus();
  return {
    machineId: getMachineId(),
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

export interface ScannedRepo {
  name: string;
  path: string;
  remoteUrl: string;
}

export interface RepoMapping {
  [folderPath: string]: { repoId: string; repoName: string };
}

export function scanForGitRepos(
  directoryPath: string,
  deps: { readdirSync: typeof fs.readdirSync; existsSync: typeof fs.existsSync; execFileSync: typeof execFileSync } = { readdirSync: fs.readdirSync, existsSync: fs.existsSync, execFileSync }
): ScannedRepo[] {
  if (!deps.existsSync(directoryPath)) return [];

  const entries = deps.readdirSync(directoryPath, { withFileTypes: true });
  const repos: ScannedRepo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folderPath = path.join(directoryPath, entry.name);
    const gitDir = path.join(folderPath, '.git');
    if (!deps.existsSync(gitDir)) continue;

    try {
      const remoteUrl = deps.execFileSync('git', ['remote', 'get-url', 'origin'], {
        cwd: folderPath,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      repos.push({ name: entry.name, path: folderPath, remoteUrl });
    } catch {
      // git command failed, skip this folder
    }
  }

  return repos;
}

export function readMapping(
  mappingPath: string,
  deps: { existsSync: typeof fs.existsSync; readFileSync: typeof fs.readFileSync } = fs
): RepoMapping {
  if (!deps.existsSync(mappingPath)) return {};
  try {
    return JSON.parse(deps.readFileSync(mappingPath, 'utf-8'));
  } catch {
    return {};
  }
}

export function writeMapping(
  mappingPath: string,
  mapping: RepoMapping,
  deps: { existsSync: typeof fs.existsSync; mkdirSync: typeof fs.mkdirSync; writeFileSync: typeof fs.writeFileSync } = fs
): void {
  const dir = path.dirname(mappingPath);
  if (!deps.existsSync(dir)) {
    deps.mkdirSync(dir, { recursive: true });
  }
  deps.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), 'utf-8');
}
