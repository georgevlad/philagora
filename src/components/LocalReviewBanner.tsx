/** Only rendered by the local fixture runner in development. */
export function LocalReviewBanner() {
  const port = Number(process.env.AGORA_REVIEW_PORT || 3100) + 1;
  return (
    <aside className="local-review-banner" aria-label="Local test preview">
      <div>
        <strong>Local test preview</strong>
        <span>Fixed sample answers · No live AI calls</span>
      </div>
      <nav aria-label="Test accounts">
        <a href={`http://127.0.0.1:${port}/login/owner`}>Use test account</a>
        <a href={`http://127.0.0.1:${port}/login/guest`}>Switch to guest</a>
      </nav>
    </aside>
  );
}
