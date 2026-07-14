import { IRepo } from '../../types/repo';

export interface IRepoRepository {
  findById(id: string, userId?: string): Promise<IRepo | null>;
  findByUser(userId: string): Promise<IRepo[]>;
  findByUrl(userId: string, url: string): Promise<IRepo | null>;
  create(data: Partial<IRepo>): Promise<IRepo>;
  update(id: string, data: Partial<IRepo>): Promise<IRepo | null>;
  delete(id: string, userId: string): Promise<boolean>;
  findTasksByRepo(repoId: string, userId: string): Promise<any[]>;
  addRepoToTask(taskId: string, repoId: string): Promise<void>;
  removeRepoFromTask(taskId: string, repoId: string): Promise<void>;
  getReposByTask(taskId: string): Promise<IRepo[]>;
}
