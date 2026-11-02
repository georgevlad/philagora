import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { QuestionComposer } from "./QuestionComposer";
import type { Philosopher } from "@/lib/types";

const WELCOME_PHILOSOPHERS = [
  "marcus-aurelius",
  "nietzsche",
  "camus",
  "confucius",
  "plato",
];

export function AgoraWelcome({
  philosophers,
  viewerKey,
}: {
  philosophers: Philosopher[];
  viewerKey: string;
}) {
  return (
    <section className="agora-welcome" aria-labelledby="welcome-title">
      <div className="agora-welcome-intro">
        <ul
          className="agora-portrait-row"
          aria-label="A few of the minds you can meet"
        >
          {WELCOME_PHILOSOPHERS.map((id) => {
            const philosopher = philosophers.find((p) => p.id === id);
            if (!philosopher) return null;
            return (
              <li key={id}>
                <div className="agora-portrait-mat">
                  <PhilosopherAvatar
                    philosopherId={id}
                    name={philosopher.name}
                    initials={philosopher.initials}
                    color={philosopher.color}
                    size="xl"
                  />
                </div>
                <span>{philosopher.name}</span>
              </li>
            );
          })}
        </ul>
        <h1 id="welcome-title">
          Ask the <em>great philosophers.</em>
        </h1>
        <p className="agora-welcome-description">
          Bring a question about your life or the world. Explore different
          perspectives from AI interpretations of history’s great thinkers.
        </p>
      </div>
      <QuestionComposer philosophers={philosophers} viewerKey={viewerKey} />
    </section>
  );
}
