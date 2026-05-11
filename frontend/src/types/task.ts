export interface Task {
  _id: string; title: string; description: string; status: string;
  visibility: string; groupIds: string[]; shareToken: string; userId: string;
  deadline: string | null;
}

export interface TaskItemData {
  _id: string;
  title: string;
  status: string;
  type?: string;
  visibility: string;
  groupIds: string[];
  shareToken: string;
  deadline: string | null;
  tags?: string[];
  pinned?: boolean;
  metadata?: { projectType?: string; repoUrl?: string; localPath?: string; environments?: string[]; services?: unknown[]; members?: unknown[] } | null;
}

export interface GroupRef { _id: string; name: string; }
