export interface KnowledgeEntry {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeListResponse {
  items: KnowledgeEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
