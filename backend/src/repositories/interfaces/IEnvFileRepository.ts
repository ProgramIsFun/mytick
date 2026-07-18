import { IEnvFile } from '../../types/envFile';

export interface IEnvFileRepository {
  findById(id: string, userId?: string): Promise<IEnvFile | null>;
  findByRepo(repoId: string, userId: string): Promise<IEnvFile[]>;
  findByUser(userId: string): Promise<IEnvFile[]>;
  create(data: Partial<IEnvFile>): Promise<IEnvFile>;
  update(id: string, data: Partial<IEnvFile>): Promise<IEnvFile | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
