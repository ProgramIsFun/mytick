export interface AccountRef { _id: string; name: string; provider: string; }

export interface SecretRef { _id: string; name: string; provider: string; }

export interface Database {
  _id: string; name: string; type: string; host: string; port: number | null;
  database: string; secretId?: SecretRef | string | null; backupEnabled: boolean;
  backupRetentionDays: number; backupFrequency: string; lastBackupAt: string | null;
  accountId: AccountRef | null; tags: string[]; notes: string;
  createdAt: string;
}

export interface BackupRecord {
  _id: string; status: 'success' | 'failed' | 'partial';
  startedAt: string; completedAt: string; durationMs: number;
  sizeBytes: number; s3Path: string; s3Bucket: string;
  errorMessage?: string; triggeredBy: 'scheduled' | 'manual';
  databaseId: { _id: string; name: string; type: string } | string;
}
