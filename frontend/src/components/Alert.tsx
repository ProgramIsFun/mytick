interface Props {
  type?: 'error' | 'success' | 'warning';
  message: string;
}

export default function Alert({ type = 'error', message }: Props) {
  const cls = type === 'error' ? 'text-danger bg-danger/10' :
    type === 'success' ? 'text-success bg-success/10' :
    'text-warning bg-warning/10';
  return <div className={`text-sm ${cls} px-3 py-2 rounded-md`}>{message}</div>;
}
