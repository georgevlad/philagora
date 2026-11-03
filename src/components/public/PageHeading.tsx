import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="public-heading">
      {eyebrow && <p className="agora-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <div className="public-deck">{children}</div>}
    </header>
  );
}
