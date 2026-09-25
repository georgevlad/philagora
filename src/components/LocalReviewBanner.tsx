/** Only rendered by the local review runners in development. */
export function LocalReviewBanner() {
  const port = Number(process.env.AGORA_REVIEW_PORT || 3100) + 1;
  const snapshot = process.env.AGORA_REVIEW_MODE === "snapshot";
  const admin = process.env.AGORA_REVIEW_MODE === "admin";
  const title = admin ? "Isolated admin preview" : snapshot ? "Local snapshot review" : "Local test preview";
  return (
    <aside className="local-review-banner" aria-label={title}>
      <div>
        <strong>{title}</strong>
        <span>{admin ? "Local database copy · Live AI disabled" : snapshot ? "Real saved content · Generation disabled" : "Fixed sample answers · No live AI calls"}</span>
      </div>
      {!admin && <nav aria-label="Test accounts">
        <a href={`http://127.0.0.1:${port}/login/owner`}>Use test account</a>
        <a href={`http://127.0.0.1:${port}/login/guest`}>Switch to guest</a>
      </nav>}
    </aside>
  );
}
