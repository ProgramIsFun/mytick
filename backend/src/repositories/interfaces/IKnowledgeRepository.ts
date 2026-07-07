export interface IKnowledge {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IKnowledgeRepository {
  findById(id: string, userId?: string): Promise<IKnowledge | null>;
  findByUser(userId: string, options?: { search?: string; page?: number; limit?: number }): Promise<{ items: IKnowledge[]; total: number }>;
  create(data: Partial<IKnowledge>): Promise<IKnowledge>;
  update(id: string, data: Partial<IKnowledge>): Promise<IKnowledge | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
