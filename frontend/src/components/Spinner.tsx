export default function Spinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="min-h-[200px] flex flex-col items-center justify-center gap-3">
      <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
      <span className="text-xs text-text-muted">{text}</span>
    </div>
  );
}

export function PageSpinner({ text }: { text?: string }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <Spinner text={text} />
    </div>
  );
}
