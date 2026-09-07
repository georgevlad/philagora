import Link from "next/link";
import { AgoraShell } from "@/components/agora/AgoraShell";

export function EmptyState({
  title,
  children,
  href,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  href?: string;
  action?: string;
}) {
  return (
    <div className="public-empty">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {href && (
        <Link className="agora-text-link" href={href}>
          {action} →
        </Link>
      )}
    </div>
  );
}

export function PageLoading({ label = "page" }: { label?: string }) {
  return (
    <AgoraShell>
      <main id="main" className="public-page public-reading" aria-busy="true">
        <div className="public-empty">
          <p className="agora-eyebrow">Philagora</p>
          <h1>A moment to turn the page.</h1>
          <p role="status">Loading {label}…</p>
          <div className="public-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </main>
    </AgoraShell>
  );
}

export function PageNotFound() {
  return (
    <AgoraShell>
      <main id="main" className="public-page public-reading">
        <div className="public-empty">
          <p className="agora-eyebrow">Page unavailable</p>
          <h1>We couldn’t find this page.</h1>
          <p>
            The link may have changed, or this content may no longer be
            available.
          </p>
          <div className="agora-actions">
            <Link href="/" className="agora-outline">
              Back to the Agora
            </Link>
            <Link href="/feed" className="agora-text-link">
              Explore the feed →
            </Link>
          </div>
        </div>
      </main>
    </AgoraShell>
  );
}
