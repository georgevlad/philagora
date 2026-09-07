"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { readAgoraDraft, writeAgoraDraft } from "@/lib/agora-draft";
import { useSession } from "@/lib/auth-client";
export function AgoraAccountLink() {
  const { data } = useSession();
  const pathname = usePathname();
  return (
    <Link
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
      {data?.user ? "Your profile" : "Sign in"}
    </Link>
  );
}
