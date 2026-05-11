import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Modal({ open, onClose, title, description, children, footer }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-surface rounded-lg border border-border p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        {title && <h2 className="text-lg font-bold text-text-primary mb-1">{title}</h2>}
        {description && <p className="text-sm text-text-muted mb-4">{description}</p>}
        {children}
        {footer && <div className="flex gap-2 justify-end mt-4">{footer}</div>}
      </div>
    </div>
  );
}
