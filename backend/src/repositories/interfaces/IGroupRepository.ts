export interface IGroup {
  id: string;
  ownerId: string;
  name: string;
  members: { userId: string; role: 'editor' | 'viewer' }[];
  createdAt: Date;
}

export interface IGroupRepository {
  findById(id: string): Promise<IGroup | null>;
  findByUser(userId: string): Promise<IGroup[]>;
  create(data: Partial<IGroup>): Promise<IGroup>;
  delete(id: string): Promise<boolean>;
  addMember(groupId: string, userId: string, role: 'editor' | 'viewer'): Promise<void>;
  removeMember(groupId: string, userId: string): Promise<void>;
  getUserGroupIds(userId: string): Promise<string[]>;
}
