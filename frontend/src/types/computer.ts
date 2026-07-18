export interface ScannedRepo {
  name: string;
  path: string;
  remoteUrl: string;
}

export interface RepoMapping {
  [folderPath: string]: { repoId: string; repoName: string };
}

export interface RepoEnvFileRaw {
  envFileId: string;
  path: string;
  content: string;
}

export interface RepoEnvFilesRawResponse {
  files: RepoEnvFileRaw[];
}
