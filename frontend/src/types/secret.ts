export interface Secret {
  _id: string;
  name: string;
  description: string;
  provider: 'bitwarden' | 'bitwarden_sm' | '1password' | 'lastpass' | 'vault' | 'aws_secrets' | 'custom' | 'client_encrypted';
  providerSecretId: string;
  type: 'api_key' | 'password' | 'connection_string' | 'certificate' | 'token' | 'other';
  tags: string[];
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
