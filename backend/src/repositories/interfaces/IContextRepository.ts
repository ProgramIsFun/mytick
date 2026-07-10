export interface IContext {
  id: string;
  key: string;
  value: string;
  updatedAt: Date;
}

export interface IContextRepository {
  findByUser(userId: string): Promise<IContext[]>;
  findByKey(userId: string, key: string): Promise<IContext | null>;
  upsert(userId: string, key: string, value: string): Promise<IContext>;
  delete(userId: string, key: string): Promise<boolean>;
}
