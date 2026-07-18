import { handleEnvWrite, handleEnvSelectDirectory } from '../src/handlers';
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
