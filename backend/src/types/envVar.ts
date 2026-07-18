export interface IEnvVar {
  id: string;
  envFileId: string;
  key: string;
  value?: string;
  isSecret: boolean;
  secretId?: string;
  comment?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}
