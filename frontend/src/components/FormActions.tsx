import Button from './Button';

interface Props {
  submitLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  submitting?: boolean;
}

export default function FormActions({ submitLabel = 'Save', cancelLabel = 'Cancel', onCancel, submitting }: Props) {
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : submitLabel}</Button>
      <Button variant="secondary" type="button" onClick={onCancel}>{cancelLabel}</Button>
    </div>
  );
}
