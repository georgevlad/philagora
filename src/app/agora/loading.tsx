import { AgoraShell } from "@/components/agora/AgoraShell";
export default function Loading() {
  return (
    <AgoraShell>
      <main id="main" className="agora-reading" aria-busy="true">
        <p className="agora-eyebrow">The Agora</p>
        <h1>A moment to gather the conversation.</h1>
        <p role="status">Loading saved questions and perspectives…</p>
        <div className="agora-wait">
          <p>Your conversation will appear here.</p>
        </div>
      </main>
    </AgoraShell>
  );
}
