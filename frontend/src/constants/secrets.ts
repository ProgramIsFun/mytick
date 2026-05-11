export const PROVIDERS: Record<string, { emoji: string; label: string }> = {
  bitwarden: { emoji: '🔐', label: 'Bitwarden' },
  bitwarden_sm: { emoji: '🔐', label: 'Bitwarden SM' },
  '1password': { emoji: '🔑', label: '1Password' },
  lastpass: { emoji: '🔒', label: 'LastPass' },
  vault: { emoji: '🏦', label: 'Vault' },
  aws_secrets: { emoji: '☁️', label: 'AWS Secrets' },
  custom: { emoji: '⚙️', label: 'Custom' },
};

export const TYPES: Record<string, { emoji: string; label: string }> = {
  api_key: { emoji: '🔑', label: 'API Key' },
  password: { emoji: '🔒', label: 'Password' },
  connection_string: { emoji: '🔗', label: 'Connection String' },
  certificate: { emoji: '📜', label: 'Certificate' },
  token: { emoji: '🎫', label: 'Token' },
  other: { emoji: '📦', label: 'Other' },
};
