import { useNavigate } from 'react-router-dom';

interface Props {
  to: string;
  label?: string;
}

export default function BackButton({ to, label }: Props) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)} className="text-sm text-accent hover:underline mb-2">
      ← Back{label ? ` to ${label}` : ''}
    </button>
  );
}
