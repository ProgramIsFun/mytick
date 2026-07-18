export interface ISecret {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: string;
  tags?: string[];
  provider: string;
  secretValue: string;
  expiresAt?: Date;
  lastRotatedAt?: Date;
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISecretRepository {
  findById(id: string, userId?: string): Promise<ISecret | null>;
  findByUser(userId: string, options?: { search?: string; provider?: string; type?: string; tag?: string }): Promise<ISecret[]>;
  create(data: Partial<ISecret>): Promise<ISecret>;
  update(id: string, data: Partial<ISecret>): Promise<ISecret | null>;
  delete(id: string, userId: string): Promise<boolean>;
  touch(id: string, userId: string): Promise<ISecret | null>;
  findUsage(id: string, userId: string): Promise<{ usedBy: { collection: string; itemId: string; itemName: string }[] }>;
}
