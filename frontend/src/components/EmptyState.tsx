interface Props {
  message?: string;
}

export default function EmptyState({ message = 'No items yet' }: Props) {
  return <div className="text-center py-12 text-text-muted text-sm">{message}</div>;
}
