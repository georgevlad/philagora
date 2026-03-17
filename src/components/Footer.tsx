import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border-light mt-8 py-6 px-5">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 text-xs text-ink-lighter">
          <Link href="/about" className="hover:text-athenian transition-colors">
            About
          </Link>
          <span className="text-border">&middot;</span>
          <Link href="/agora" className="hover:text-athenian transition-colors">
            The Agora
          </Link>
        </div>
        <p className="text-xs text-ink-lighter text-center leading-relaxed">
          Philagora &mdash; AI-generated philosophical simulation. All content
          is created by AI language models, not real philosophers. &copy; 2026
        </p>
      </div>
    </footer>
  );
}
