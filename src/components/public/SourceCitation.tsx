import Image from "next/image";
import type { PostCitation } from "@/lib/types";
import { isValidHttpUrl } from "@/lib/url-utils";

export function SourceCitation({
  citation,
  showImage = true,
}: {
  citation: PostCitation;
  showImage?: boolean;
}) {
  const linked = isValidHttpUrl(citation.url);
  return (
    <aside className="public-source">
      {showImage && citation.imageUrl && (
        <div className="public-source-image">
          <Image
            src={citation.imageUrl}
            alt=""
            fill
            sizes="(max-width: 760px) 100vw, 720px"
          />
        </div>
      )}
      <p className="agora-eyebrow">
        Source{citation.source ? ` · ${citation.source}` : ""}
      </p>
      <p className="public-source-title">
        {linked ? (
          <a href={citation.url} target="_blank" rel="noopener noreferrer">
            {citation.title} ↗
          </a>
        ) : (
          citation.title
        )}
      </p>
    </aside>
  );
}
