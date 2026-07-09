export interface Task {
  id: string; title: string; description: string; status: string;
  visibility: string; groupIds: string[]; shareToken: string; userId: string;
  deadline: string | null;
}

export interface TaskItemData {
  id: string;
  title: string;
  status: string;
  type?: string;
  visibility: string;
  groupIds: string[];
  shareToken: string;
  userId: string;
  deadline: string | null;
  tags?: string[];
  pinned?: boolean;
  metadata?: { projectType?: string; repoUrl?: string; localPath?: string; environments?: string[]; services?: unknown[]; members?: unknown[] } | null;
}

export interface GroupRef { id: string; name: string; }
