export function AIBadge({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="AI generated response"
      title="AI generated response"
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-ink-lighter ${className}`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 16 16"
        fill="none"
        className="opacity-50"
        >
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5 8.5L7 10.5L11 6"
            stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
            strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
