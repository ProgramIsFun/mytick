import { type ReactNode } from 'react';

interface Props {
  expanded: boolean;
  onToggle: () => void;
  header: ReactNode;
  children: ReactNode;
  headerClassName?: string;
}

export default function ExpandableItem({ expanded, onToggle, header, children, headerClassName = '' }: Props) {
  return (
    <div className="border border-border rounded-lg bg-surface overflow-hidden">
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-hover ${headerClassName}`}
        onClick={onToggle}
      >
        {header}
        <span className="text-xs text-text-muted ml-auto">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="border-t border-border-light px-4 py-3 bg-surface-secondary">
          {children}
        </div>
      )}
    </div>
  );
}
