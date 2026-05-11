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
