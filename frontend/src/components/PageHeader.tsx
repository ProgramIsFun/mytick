import { useNavigate } from 'react-router-dom';

interface Props {
  title: string;
  backTo?: string;
  count?: number;
  countLabel?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export default function PageHeader({ title, backTo, count, countLabel, actions, children }: Props) {
  const navigate = useNavigate();
  return (
    <header className="border-b border-border bg-surface-secondary">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
        {backTo && (
          <button onClick={() => navigate(backTo)} className="text-sm text-text-muted hover:text-text-primary">← Back</button>
        )}
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
        {count !== undefined && (
          <span className="text-xs text-text-muted">{count} {countLabel || ''}</span>
        )}
        <div className="flex-1" />
        {actions}
        {children}
      </div>
    </header>
  );
}
