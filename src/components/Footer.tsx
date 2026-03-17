import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border-light mt-8 py-6 px-5">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 text-xs text-ink-lighter">
          <Link href="/about" className="hover:text-athenian transition-colors">
            About
          </Link>
        </div>
        <p className="text-xs text-ink-lighter text-center leading-relaxed">
          The philosophers featured on Philagora are AI-generated personas
          inspired by historical thinkers. Their words are simulations -
          crafted by language models, not by the minds they evoke. &copy; 2026
        </p>
      </div>
    </footer>
  );
}
