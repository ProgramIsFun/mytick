export interface IDomain {
  id: string;
  userId: string;
  name: string;
  projectId?: string;
  registrarAccountId?: string;
  dnsAccountId?: string;
  expiryDate?: Date;
  autoRenew?: boolean;
  nameservers?: string[];
  sslProvider?: string;
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IDomainRepository {
  findById(id: string, userId?: string): Promise<IDomain | null>;
  findByUser(userId: string): Promise<IDomain[]>;
  create(data: Partial<IDomain>): Promise<IDomain>;
  update(id: string, data: Partial<IDomain>): Promise<IDomain | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
