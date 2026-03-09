export function EditorialDivider({ icon = "\u2766" }: { icon?: string }) {
  return (
    <div className="editorial-divider mx-4 my-3">
      <span className="divider-icon">{icon}</span>
    </div>
  );
}
