export const TASK_TYPES = ['task', 'project'] as const;
export const TASK_STATUSES = ['pending', 'in_progress', 'on_hold', 'done', 'abandoned'] as const;
export const VISIBILITY_LEVELS = ['private', 'group', 'public'] as const;
export const RECURRENCE_FREQS = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

export const SECRET_TYPES = ['connection_string', 'password', 'api_key', 'token', 'certificate', 'ssh_key', 'other'] as const;
export const SECRET_PROVIDERS = ['bitwarden', 'bitwarden_sm', 'aws_secrets', '1password', 'vault', 'lastpass', 'custom'] as const;

export const DB_TYPES = ['mongodb', 'postgres', 'mysql', 'redis', 'sqlite', 'other'] as const;
export const DB_FREQUENCIES = ['hourly', '6hours', 'daily', 'weekly'] as const;

export const BACKUP_STATUSES = ['success', 'failed', 'partial'] as const;
