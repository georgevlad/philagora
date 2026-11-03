"use client";

import { useEffect, useState } from "react";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import type { AgoraRecovery, AgoraResponse, Philosopher } from "@/lib/types";

export function ActivityDots() {
  return <span className="agora-activity-dots" aria-hidden="true"><i /><i /><i /></span>;
}

export function MatchingProgress() {
  const [takingLonger, setTakingLonger] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTakingLonger(true), 12000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="agora-matching agora-enter">
      <div className="agora-matching-placeholders" aria-hidden="true">
        {[0, 1].map((index) => (
          <div className="agora-match-placeholder" key={index}>
            <div className="agora-skeleton agora-skeleton-portrait" />
            <div className="agora-skeleton-copy">
              <span className="agora-skeleton" />
              <span className="agora-skeleton" />
            </div>
            <div className="agora-skeleton-copy agora-skeleton-reason">
              <span className="agora-skeleton" />
              <span className="agora-skeleton" />
            </div>
          </div>
        ))}
      </div>
      <p className="agora-activity-note" role="status">
        <ActivityDots />
        <span>{takingLonger
          ? "Still finding the right mix. You can keep editing your question while we look."
          : "Looking for thinkers who will bring different perspectives."}</span>
      </p>
      <p className="agora-meta">You’ll meet your group and can change it before asking.</p>
    </div>
  );
}

export type ConversationProgressProps = {
  group: Philosopher[];
  responses: AgoraResponse[];
  hasSynthesis: boolean;
  state: AgoraRecovery["state"];
  connectionIssue?: boolean;
};

export function ConversationProgress({ group, responses, hasSynthesis, state, connectionIssue }: ConversationProgressProps) {
  const missing = group.filter((p) => !responses.some((r) => r.philosopherId === p.id));
  const running = state === "running" && !connectionIssue;
  const waitingLabel = connectionIssue ? "Checking connection" : state === "retry_wait" ? "Waiting to resume" : "In the queue";
  // Only saved answers advance progress. No timer-based percentages or invented stages.
  const steps = [
    ...group.map((p) => ({
      id: p.id,
      name: p.name,
      philosopher: p,
      complete: !missing.some((m) => m.id === p.id),
      active: running && p.id === missing[0]?.id,
      pendingLabel: running ? "Up next" : waitingLabel,
      activeLabel: "Considering your question",
    })),
    {
      id: "synthesis",
      name: "A shared reflection",
      philosopher: null,
      complete: hasSynthesis,
      active: running && !missing.length && !hasSynthesis,
      pendingLabel: missing.length ? "After the responses" : waitingLabel,
      activeLabel: "Bringing the ideas together",
    },
  ];
  return (
    <div className="agora-conversation-progress">
      <div className="agora-progress-track" aria-hidden="true">
        {steps.map((step) => <span key={step.id} data-state={step.complete ? "complete" : step.active ? "active" : "waiting"} />)}
      </div>
      <ol className="agora-progress-list" aria-label="Conversation progress">
        {steps.map((step) => (
          <li key={step.id} data-state={step.complete ? "complete" : step.active ? "active" : "waiting"}>
            <div className="agora-progress-portrait" aria-hidden="true">
              {step.philosopher ? <PhilosopherAvatar
                philosopherId={step.id} name={step.name}
                initials={step.philosopher.initials} color={step.philosopher.color} size="sm"
              /> : <span className="agora-reflection-symbol">✦</span>}
            </div>
            <span className="agora-progress-person">{step.name}</span>
            <span className="agora-progress-state">
              {step.complete ? <><span className="agora-progress-check" aria-hidden="true">✓</span> Ready</>
                : step.active ? <>{step.activeLabel}<ActivityDots /></> : step.pendingLabel}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
