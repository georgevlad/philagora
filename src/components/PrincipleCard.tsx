export function PrincipleCard({
  principle,
}: {
  principle: { title: string; description: string };
}) {
  return (
    <div
      className="animate-fade-in-up p-4 rounded-lg border border-border-light hover:border-border transition-colors duration-200"
    >
      <h4 className="font-serif font-bold text-ink text-sm mb-1.5">
        {principle.title}
      </h4>
      <p className="text-sm text-ink-light leading-relaxed">
        {principle.description}
      </p>
    </div>
  );
}
