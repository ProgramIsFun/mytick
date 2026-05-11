export function daysUntilExpiry(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export function expiryBadge(date: string | null) {
  if (!date) return null;
  const days = daysUntilExpiry(date);
  if (days < 30) {
    if (days < 0) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-danger/15 text-danger font-medium">Expired</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">{days}d left</span>;
  }
  return <span className="text-xs text-text-muted">{new Date(date).toLocaleDateString()}</span>;
}
