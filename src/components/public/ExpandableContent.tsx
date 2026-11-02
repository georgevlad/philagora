"use client";

import { useId, useState, type ReactNode } from "react";

export function ExpandableContent({
  children, preview, collapsible, className,
  expandLabel = "Read more", collapseLabel = "Show less",
}: {
  children: ReactNode;
  preview: ReactNode;
  collapsible: boolean;
  className?: string;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div id={id} className={className}>{collapsible && !expanded ? preview : children}</div>
      {collapsible && (
        <button type="button" className="agora-text-link reading-expand" aria-expanded={expanded} aria-controls={id}
          onClick={() => setExpanded(!expanded)}>
          {expanded ? collapseLabel : expandLabel}
        </button>
      )}
    </>
  );
}
