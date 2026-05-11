interface Secret { _id: string; name: string; provider: string; }

interface Props {
  secrets: Secret[];
  onSelect: (secretId: string) => void;
  onClose: () => void;
  title?: string;
  description?: string;
}

export default function SecretPicker({ secrets, onSelect, onClose, title = 'Select Secret', description = 'Pick a secret to link.' }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-surface rounded-lg border border-border p-6 max-w-md w-full">
        <h2 className="text-lg font-bold text-text-primary mb-2">{title}</h2>
        <p className="text-sm text-text-muted mb-4">{description}</p>
        <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
          {secrets.map(secret => (
            <button
              key={secret._id}
              onClick={() => onSelect(secret._id)}
              className="w-full text-left px-3 py-2 rounded border border-border hover:bg-surface-hover text-sm flex items-center gap-2"
            >
              <span>{secret.name}</span>
              <span className="text-xs text-text-muted">({secret.provider})</span>
            </button>
          ))}
          {secrets.length === 0 && (
            <div className="text-sm text-text-muted">No secrets found. Create one first.</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-sm px-4 py-2 rounded border border-border hover:bg-surface-hover"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
