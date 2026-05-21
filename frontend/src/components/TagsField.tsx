interface Props { label?: string; tags: string[]; }

export default function TagsField({ label = 'Tags', tags }: Props) {
  if (tags.length === 0) return null;
  return (
    <div>
      <label className="text-xs font-medium text-text-muted block mb-1">{label}</label>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span key={tag} className="text-xs px-2 py-1 rounded bg-surface-secondary border border-border text-text-primary">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
