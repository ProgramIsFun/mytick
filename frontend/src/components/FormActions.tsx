import Button from './Button';

interface Props {
  submitLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
}

export default function FormActions({ submitLabel = 'Save', cancelLabel = 'Cancel', onCancel }: Props) {
  return (
    <div className="flex gap-2">
      <Button type="submit">{submitLabel}</Button>
      <Button variant="secondary" type="button" onClick={onCancel}>{cancelLabel}</Button>
    </div>
  );
}
