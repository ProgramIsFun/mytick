export function formatSize(bytes: number) {
  if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function formatDuration(ms: number) {
  if (ms > 60000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 1000).toFixed(0)}s`;
}

export function formatObjectIdDate(id: string) {
  return new Date(parseInt(id.slice(0, 8), 16) * 1000).toLocaleString();
}

export function timeSince(date: string | null) {
  if (!date) return 'Never';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
