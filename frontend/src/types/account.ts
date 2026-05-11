export interface SecretRef { _id: string; name: string; provider: string; }

export interface Credential { key: string; secretId: SecretRef | string; }

export interface Account {
  _id: string; name: string; provider: string; url: string;
  username: string; notes: string; tags: string[]; credentials: Credential[];
  parentAccountId: string | null;
}
