import type { AccountRef as CommonAccountRef } from './common';

export type { CommonAccountRef as AccountRef };

export interface ProjectRef { _id: string; title: string; }

export interface Domain {
  _id: string; name: string; expiryDate: string | null; autoRenew: boolean;
  nameservers: string[]; sslProvider: string; notes: string; tags: string[];
  registrarAccountId: CommonAccountRef | null; dnsAccountId: CommonAccountRef | null;
  projectId: ProjectRef | null;
}
