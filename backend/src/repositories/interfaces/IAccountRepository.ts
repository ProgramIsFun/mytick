export interface IAccount {
  id: string;
  userId: string;
  name: string;
  provider: string;
  parentAccountId?: string;
  linkedAccountId?: string;
  url?: string;
  username?: string;
  notes?: string;
  tags?: string[];
  credentials?: { key: string; secretId: string }[];
  accountId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccountRepository {
  findById(id: string, userId?: string): Promise<IAccount | null>;
  findByUser(userId: string): Promise<IAccount[]>;
  findSubAccounts(parentId: string): Promise<IAccount[]>;
  create(data: Partial<IAccount>): Promise<IAccount>;
  update(id: string, data: Partial<IAccount>): Promise<IAccount | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
