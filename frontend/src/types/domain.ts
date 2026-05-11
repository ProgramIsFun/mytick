export interface AccountRef { _id: string; name: string; provider: string; }

export interface ProjectRef { _id: string; title: string; }

export interface Domain {
  _id: string; name: string; expiryDate: string | null; autoRenew: boolean;
  nameservers: string[]; sslProvider: string; notes: string; tags: string[];
  registrarAccountId: AccountRef | null; dnsAccountId: AccountRef | null;
  projectId: ProjectRef | null;
}
