import { AgoraShell } from "@/components/agora/AgoraShell";
import { ActivityDots } from "@/components/agora/AgoraProgress";
export default function Loading() {
  return (
    <AgoraShell>
      <main id="main" className="agora-reading" aria-busy="true">
        <p className="agora-eyebrow">The Agora</p>
        <h1>A moment to gather the conversation.</h1>
        <p className="agora-activity-label" role="status"><ActivityDots />Loading saved questions and perspectives…</p>
        <div className="agora-wait agora-loading-placeholder" aria-hidden="true">
          <div className="agora-skeleton agora-skeleton-portrait" />
          <div className="agora-skeleton-copy"><span className="agora-skeleton" /><span className="agora-skeleton" /><span className="agora-skeleton" /></div>
        </div>
      </main>
    </AgoraShell>
  );
}
