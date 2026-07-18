import { IEnvVar } from '../../types/envVar';

export interface IEnvVarRepository {
  findById(id: string, userId?: string): Promise<IEnvVar | null>;
  findByEnvFile(envFileId: string, userId: string): Promise<IEnvVar[]>;
  create(data: Partial<IEnvVar>): Promise<IEnvVar>;
  update(id: string, data: Partial<IEnvVar>): Promise<IEnvVar | null>;
  delete(id: string, userId: string): Promise<boolean>;
  deleteByEnvFile(envFileId: string, userId: string): Promise<number>;
}
