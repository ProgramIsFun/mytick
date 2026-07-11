import type { SecretRef as CommonSecretRef } from './common';

export type { CommonSecretRef as SecretRef };

export interface Credential { key: string; secretId: CommonSecretRef | string; }

export interface Account {
  id: string; name: string; provider: string; url: string;
  username: string; notes: string; tags: string[]; credentials: Credential[];
  parentAccountId: string | null;
  accountId?: string;
}
