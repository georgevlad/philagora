export function EditorialDivider({ icon = "?" }: { icon?: string }) {
  return (
    <div className="editorial-divider mx-6 my-4 opacity-80">
      <span className="divider-icon">{icon}</span>
    </div>
  );
}
