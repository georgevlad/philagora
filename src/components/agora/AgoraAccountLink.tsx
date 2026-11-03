"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { readAgoraDraft, writeAgoraDraft } from "@/lib/agora-draft";
import { useSession } from "@/lib/auth-client";
export function AgoraAccountLink() {
  const { data, isPending } = useSession();
  const pathname = usePathname();
  if (isPending) {
    return (
      <span className="agora-account-loading" aria-hidden="true">
        <span />
      </span>
    );
  }
  return (
    <Link
      className="agora-account-link"
      aria-label={data?.user ? "Your library" : "Sign in"}
      aria-current={
        pathname === "/profile" || pathname === "/sign-in" ? "page" : undefined
      }
      onClick={() => {
        if (!data?.user) {
          const draft = readAgoraDraft("agora:draft:guest");
          if (draft) writeAgoraDraft("agora:sign-in-draft", draft);
        }
      }}
      href={
        data?.user
          ? "/profile"
          : `/sign-in?returnTo=${encodeURIComponent(pathname)}`
      }
    >
      {data?.user ? <><span className="agora-library-full">Your library</span><span className="agora-library-short" aria-hidden="true">Library</span></> : "Sign in"}
    </Link>
  );
}
