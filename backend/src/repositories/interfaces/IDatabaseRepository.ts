export interface IDatabase {
  id: string;
  userId: string;
  name: string;
  type: string;
  secretId?: string;
  host?: string;
  port?: number | null;
  databaseName?: string;
  backupEnabled: boolean;
  backupRetentionDays: number;
  backupFrequency: string;
  lastBackupAt?: Date | null;
  accountId?: string;
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDatabaseRepository {
  findById(id: string, userId?: string): Promise<IDatabase | null>;
  findByUser(userId: string, options?: { search?: string; type?: string; backupEnabled?: boolean }): Promise<IDatabase[]>;
  findBackupable(userId: string): Promise<IDatabase[]>;
  create(data: Partial<IDatabase>): Promise<IDatabase>;
  update(id: string, data: Partial<IDatabase>): Promise<IDatabase | null>;
  delete(id: string, userId: string): Promise<boolean>;
  markBackupSuccess(id: string): Promise<IDatabase | null>;
}
