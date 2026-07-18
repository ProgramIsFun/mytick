import { scanForGitRepos, readMapping, writeMapping } from '../src/handlers';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('scanForGitRepos', () => {
  it('should return repos with git remotes', () => {
    const mockReaddirSync = jest.fn().mockReturnValue([
      { name: 'repo-a', isDirectory: () => true },
      { name: 'repo-b', isDirectory: () => true },
      { name: 'file.txt', isDirectory: () => false },
    ]);
    const mockExistsSync = jest.fn().mockReturnValue(true);
    const mockExecFileSync = jest.fn()
      .mockReturnValueOnce('git@github.com:user/repo-a.git\n')
      .mockReturnValueOnce('https://github.com/user/repo-b.git\n');

    const repos = scanForGitRepos('/projects', {
      readdirSync: mockReaddirSync,
      existsSync: mockExistsSync,
      execFileSync: mockExecFileSync,
    });

    expect(repos).toEqual([
      { name: 'repo-a', path: path.join('/projects', 'repo-a'), remoteUrl: 'git@github.com:user/repo-a.git' },
      { name: 'repo-b', path: path.join('/projects', 'repo-b'), remoteUrl: 'https://github.com/user/repo-b.git' },
    ]);
  });

  it('should skip folders without .git', () => {
    const mockReaddirSync = jest.fn().mockReturnValue([
      { name: 'not-a-repo', isDirectory: () => true },
    ]);
    const mockExistsSync = jest.fn().mockReturnValue(false);
    const mockExecFileSync = jest.fn();

    const repos = scanForGitRepos('/projects', {
      readdirSync: mockReaddirSync,
      existsSync: mockExistsSync,
      execFileSync: mockExecFileSync,
    });

    expect(repos).toEqual([]);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('should skip non-git directories', () => {
    const mockReaddirSync = jest.fn().mockReturnValue([
      { name: 'normal-folder', isDirectory: () => true },
    ]);
    const mockExistsSync = jest.fn().mockImplementation((p: string) => p.endsWith('.git'));
    const mockExecFileSync = jest.fn();

    const repos = scanForGitRepos('/projects', {
      readdirSync: mockReaddirSync,
      existsSync: mockExistsSync,
      execFileSync: mockExecFileSync,
    });

    expect(repos).toEqual([]);
  });

  it('should handle git command failure gracefully', () => {
    const mockReaddirSync = jest.fn().mockReturnValue([
      { name: 'broken-repo', isDirectory: () => true },
    ]);
    const mockExistsSync = jest.fn().mockReturnValue(true);
    const mockExecFileSync = jest.fn().mockImplementation(() => {
      throw new Error('not a git repository');
    });

    const repos = scanForGitRepos('/projects', {
      readdirSync: mockReaddirSync,
      existsSync: mockExistsSync,
      execFileSync: mockExecFileSync,
    });

    expect(repos).toEqual([]);
  });

  it('should return empty array for non-existent directory', () => {
    const mockReaddirSync = jest.fn();
    const mockExistsSync = jest.fn().mockReturnValue(false);
    const mockExecFileSync = jest.fn();

    const repos = scanForGitRepos('/nonexistent', {
      readdirSync: mockReaddirSync,
      existsSync: mockExistsSync,
      execFileSync: mockExecFileSync,
    });

    expect(repos).toEqual([]);
    expect(mockReaddirSync).not.toHaveBeenCalled();
  });
});

describe('readMapping', () => {
  it('should read existing mapping file', () => {
    const data = { '/home/user/projects/mytick': { repoId: 'abc', repoName: 'mytick' } };
    const mockExistsSync = jest.fn().mockReturnValue(true);
    const mockReadFileSync = jest.fn().mockReturnValue(JSON.stringify(data));

    const result = readMapping('/config/repo-mapping.json', {
      existsSync: mockExistsSync,
      readFileSync: mockReadFileSync,
    });

    expect(result).toEqual(data);
  });

  it('should return empty object when file does not exist', () => {
    const mockExistsSync = jest.fn().mockReturnValue(false);
    const mockReadFileSync = jest.fn();

    const result = readMapping('/config/repo-mapping.json', {
      existsSync: mockExistsSync,
      readFileSync: mockReadFileSync,
    });

    expect(result).toEqual({});
  });

  it('should return empty object on parse error', () => {
    const mockExistsSync = jest.fn().mockReturnValue(true);
    const mockReadFileSync = jest.fn().mockReturnValue('not json');

    const result = readMapping('/config/repo-mapping.json', {
      existsSync: mockExistsSync,
      readFileSync: mockReadFileSync,
    });

    expect(result).toEqual({});
  });
});

describe('writeMapping', () => {
  it('should write mapping to file', () => {
    const mapping = { '/home/user/projects/mytick': { repoId: 'abc', repoName: 'mytick' } };
    const mockExistsSync = jest.fn().mockReturnValue(true);
    const mockWriteFileSync = jest.fn();

    writeMapping('/config/repo-mapping.json', mapping, {
      writeFileSync: mockWriteFileSync,
    });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/config/repo-mapping.json',
      JSON.stringify(mapping, null, 2),
      'utf-8'
    );
  });
});
