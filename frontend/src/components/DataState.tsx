import Spinner from './Spinner';
import EmptyState from './EmptyState';

interface Props<T> {
  loading: boolean;
  items: T[];
  loadingText?: string;
  emptyMessage?: string;
  children: React.ReactNode;
}

export default function DataState<T>({ loading, items, loadingText = 'Loading...', emptyMessage = 'No data yet', children }: Props<T>) {
  if (loading) return <Spinner text={loadingText} />;
  if (items.length === 0) return <EmptyState message={emptyMessage} />;
  return <>{children}</>;
}
