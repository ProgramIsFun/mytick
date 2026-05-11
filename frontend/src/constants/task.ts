export const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-warning/15 text-warning' },
  in_progress: { label: 'In Progress', cls: 'bg-accent/15 text-accent' },
  on_hold: { label: 'On Hold', cls: 'bg-purple/15 text-purple' },
  done: { label: 'Done', cls: 'bg-success/15 text-success' },
  abandoned: { label: 'Abandoned', cls: 'bg-gray/15 text-gray' },
};
