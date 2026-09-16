import Link from "next/link";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";

export function PhilosopherLink({
  id,
  name,
  color,
  initials,
  detail,
}: {
  id: string;
  name: string;
  color: string;
  initials: string;
  detail?: string;
}) {
  return (
    <Link className="public-person" href={`/philosophers/${id}`}>
      <span className="public-person-portrait" aria-hidden="true">
        <PhilosopherAvatar
          philosopherId={id}
          name={name}
          color={color}
          initials={initials}
          size="sm"
        />
      </span>
      <span className="public-person-copy">
        <span className="public-person-name">{name}</span>
        {detail && <small>{detail}</small>}
      </span>
    </Link>
  );
}
