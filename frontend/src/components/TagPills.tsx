interface Props { tags: string[]; }

export default function TagPills({ tags }: Props) {
  if (tags.length === 0) return null;
  return (
    <div className="flex gap-1">
      {tags.map(t => (
        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{t}</span>
      ))}
    </div>
  );
}
