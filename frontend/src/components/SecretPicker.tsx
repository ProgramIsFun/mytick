import type { Secret } from '../types/secret';
import Modal from './Modal';

interface Props {
  secrets: Secret[];
  onSelect: (secretId: string) => void;
  onClose: () => void;
  title?: string;
  description?: string;
}

export default function SecretPicker({ secrets, onSelect, onClose, title = 'Select Secret', description = 'Pick a secret to link.' }: Props) {
  return (
    <Modal open onClose={onClose} title={title} description={description}>
      <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
        {secrets.map(secret => (
          <button
            key={secret.id}
            onClick={() => onSelect(secret.id)}
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
    </Modal>
  );
}
