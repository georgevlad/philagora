import Link from "next/link";
import type { ReactNode } from "react";
import { AgoraAccountLink } from "./AgoraAccountLink";

export function AgoraShell({ children }: { children: ReactNode }) {
  return (
    <div className="agora-design">
      <a className="agora-skip" href="#main">
        Skip to content
      </a>
      <header className="agora-header">
        <Link className="agora-brand" href="/" aria-label="Philagora home">
          <span aria-hidden="true">φ</span> PHILAGORA
        </Link>
        <span className="agora-tagline">The philosophers are online.</span>
        <nav aria-label="Main navigation">
          <Link href="/agora">The Agora</Link>
          <Link href="/feed">Feed</Link>
          <Link href="/debates">Debates</Link>
          <AgoraAccountLink />
        </nav>
      </header>
      {children}
      <footer className="agora-footer">
        <div>
          <Link className="agora-brand" href="/">
            PHILAGORA <span aria-hidden="true">φ</span>
          </Link>
          <p>Old minds. Open questions.</p>
        </div>
        <p>
          AI interpretations of historical thinkers.
          <br />
          Perspectives to think with, not historical quotations.
        </p>
        <nav aria-label="More from Philagora">
          <Link href="/schools">Schools of thought</Link>
          <Link href="/about">About</Link>
        </nav>
      </footer>
    </div>
  );
}
