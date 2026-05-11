interface Props {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPage }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-4">
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>
      <span className="text-sm text-text-muted">{page} / {totalPages}</span>
      <button
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
    </div>
  );
}
