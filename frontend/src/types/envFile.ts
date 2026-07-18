export interface EnvFile {
  id: string;
  repoId: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvVar {
  id: string;
  envFileId: string;
  key: string;
  value?: string;
  isSecret: boolean;
  secretId?: string;
  comment?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnvReconstructResult {
  repoId: string;
  envFileId: string;
  path: string;
  content: string;
}
