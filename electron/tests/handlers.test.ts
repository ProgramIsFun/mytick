import { handleEnvWrite, handleEnvSelectDirectory, getSystemInfo } from '../src/handlers';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('handleEnvWrite', () => {
  const tmpDir = path.join(os.tmpdir(), 'electron-test-write');

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should write file to existing directory', async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, '.env');

    const result = await handleEnvWrite({ filePath, content: 'FOO=bar\nBAZ=qux' });

    expect(result).toEqual({ success: true });
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('FOO=bar\nBAZ=qux');
  });

  it('should create directory if it does not exist', async () => {
    const nested = path.join(tmpDir, 'a', 'b', 'c');
    const filePath = path.join(nested, '.env');

    const result = await handleEnvWrite({ filePath, content: 'KEY=VALUE' });

    expect(result).toEqual({ success: true });
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('KEY=VALUE');
  });

  it('should overwrite existing file', async () => {
    const filePath = path.join(tmpDir, 'overwrite.env');
    fs.writeFileSync(filePath, 'OLD=content', 'utf-8');

    const result = await handleEnvWrite({ filePath, content: 'NEW=content' });

    expect(result).toEqual({ success: true });
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('NEW=content');
  });

  it('should handle empty content', async () => {
    const filePath = path.join(tmpDir, 'empty.env');

    const result = await handleEnvWrite({ filePath, content: '' });

    expect(result).toEqual({ success: true });
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('');
  });

  it('should handle multiline env content', async () => {
    const filePath = path.join(tmpDir, 'multiline.env');
    const content = '# Comment\nDB_HOST=localhost\nDB_PORT=5432\n\n# Secrets\nAPI_KEY=abc123';

    const result = await handleEnvWrite({ filePath, content });

    expect(result).toEqual({ success: true });
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(content);
  });

  it('should handle unicode content', async () => {
    const filePath = path.join(tmpDir, 'unicode.env');

    const result = await handleEnvWrite({ filePath, content: 'GREETING=こんにちは世界' });

    expect(result).toEqual({ success: true });
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('GREETING=こんにちは世界');
  });

  it('should return error when write fails', async () => {
    const result = await handleEnvWrite(
      { filePath: '/nonexistent-root-path/file.env', content: 'x=y' },
      {
        existsSync: () => false,
        mkdirSync: () => { throw new Error('Permission denied'); },
        writeFileSync: jest.fn(),
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Permission denied');
  });

  it('should skip mkdir if directory exists', async () => {
    const mkdirSync = jest.fn();
    const writeFileSync = jest.fn();

    const result = await handleEnvWrite(
      { filePath: path.join(tmpDir, 'file.env'), content: 'A=B' },
      { existsSync: () => true, mkdirSync, writeFileSync }
    );

    expect(result).toEqual({ success: true });
    expect(mkdirSync).not.toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledWith(path.join(tmpDir, 'file.env'), 'A=B', 'utf-8');
  });
});

describe('handleEnvSelectDirectory', () => {
  it('should return selected path', async () => {
    const mockDialog = {
      showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: ['/home/user/project'] }),
    };

    const result = await handleEnvSelectDirectory(mockDialog);

    expect(result).toEqual({ path: '/home/user/project' });
    expect(mockDialog.showOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory'] });
  });

  it('should return null when cancelled', async () => {
    const mockDialog = {
      showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    };

    const result = await handleEnvSelectDirectory(mockDialog);

    expect(result).toBeNull();
  });

  it('should return null when no paths returned', async () => {
    const mockDialog = {
      showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
    };

    const result = await handleEnvSelectDirectory(mockDialog);

    expect(result).toBeNull();
  });
});

describe('getSystemInfo', () => {
  const mockOs = {
    platform: jest.fn().mockReturnValue('win32'),
    arch: jest.fn().mockReturnValue('x64'),
    hostname: jest.fn().mockReturnValue('DESKTOP-ABC'),
    type: jest.fn().mockReturnValue('Windows_NT'),
    release: jest.fn().mockReturnValue('10.0.26200'),
    cpus: jest.fn().mockReturnValue([
      { model: 'Intel Core i7-12700K' },
      { model: 'Intel Core i7-12700K' },
      { model: 'Intel Core i7-12700K' },
      { model: 'Intel Core i7-12700K' },
    ]),
    totalmem: jest.fn().mockReturnValue(34359738368), // 32 GB
    freemem: jest.fn().mockReturnValue(17179869184), // 16 GB
    uptime: jest.fn().mockReturnValue(36000), // 10 hours
    homedir: jest.fn().mockReturnValue('C:\\Users\\testuser'),
    tmpdir: jest.fn().mockReturnValue('C:\\Users\\testuser\\AppData\\Local\\Temp'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return correct system info', () => {
    const mockGetMachineId = jest.fn().mockReturnValue('test-machine-id-123');
    const info = getSystemInfo(mockOs as never, mockGetMachineId);

    expect(info).toEqual({
      machineId: 'test-machine-id-123',
      platform: 'win32',
      arch: 'x64',
      hostname: 'DESKTOP-ABC',
      osType: 'Windows_NT',
      osRelease: '10.0.26200',
      cpuModel: 'Intel Core i7-12700K',
      cpuCores: 4,
      totalMemoryMB: 32768,
      freeMemoryMB: 16384,
      uptimeHours: 10,
      homeDir: 'C:\\Users\\testuser',
      tmpDir: 'C:\\Users\\testuser\\AppData\\Local\\Temp',
    });

    expect(mockGetMachineId).toHaveBeenCalled();
    expect(mockOs.platform).toHaveBeenCalled();
    expect(mockOs.arch).toHaveBeenCalled();
    expect(mockOs.hostname).toHaveBeenCalled();
    expect(mockOs.type).toHaveBeenCalled();
    expect(mockOs.release).toHaveBeenCalled();
    expect(mockOs.cpus).toHaveBeenCalled();
    expect(mockOs.totalmem).toHaveBeenCalled();
    expect(mockOs.freemem).toHaveBeenCalled();
    expect(mockOs.uptime).toHaveBeenCalled();
    expect(mockOs.homedir).toHaveBeenCalled();
    expect(mockOs.tmpdir).toHaveBeenCalled();
  });

  it('should handle zero CPUs', () => {
    mockOs.cpus.mockReturnValue([]);
    const info = getSystemInfo(mockOs as never, () => 'test-id');
    expect(info.cpuModel).toBe('unknown');
    expect(info.cpuCores).toBe(0);
  });

  it('should round uptime to one decimal', () => {
    mockOs.uptime.mockReturnValue(3661); // 1 hour 1 minute
    const info = getSystemInfo(mockOs as never, () => 'test-id');
    expect(info.uptimeHours).toBe(1.0);
  });

  it('should round memory to nearest MB', () => {
    mockOs.totalmem.mockReturnValue(8589934592); // exactly 8 GB
    mockOs.freemem.mockReturnValue(4294967296); // exactly 4 GB
    const info = getSystemInfo(mockOs as never, () => 'test-id');
    expect(info.totalMemoryMB).toBe(8192);
    expect(info.freeMemoryMB).toBe(4096);
  });
});
