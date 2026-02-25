"use client";

import { useState } from "react";
import Image from "next/image";
import { philosophers } from "@/data/philosophers";

export function PhilosopherAvatar({
  philosopherId,
  size = "md",
}: {
  philosopherId: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const philosopher = philosophers[philosopherId];
  const [imgError, setImgError] = useState(false);

  if (!philosopher) return null;

  const sizeConfig = {
    sm: { classes: "w-8 h-8 text-xs", px: 32, ring: 2 },
    md: { classes: "w-10 h-10 text-sm", px: 40, ring: 2 },
    lg: { classes: "w-14 h-14 text-lg", px: 56, ring: 2.5 },
    xl: { classes: "w-20 h-20 text-2xl", px: 80, ring: 3 },
  };

  const { classes, px, ring } = sizeConfig[size];
  const avatarSrc = `/avatars/${philosopherId}.svg`;

  return (
    <div
      className={`${classes} rounded-full shrink-0 transition-transform duration-200 hover:scale-105 relative overflow-hidden`}
      style={{
        boxShadow: `0 0 0 ${ring}px ${philosopher.color}30`,
      }}
      title={philosopher.name}
    >
      {!imgError ? (
        <Image
          src={avatarSrc}
          alt={philosopher.name}
          width={px}
          height={px}
          className="rounded-full object-cover"
          onError={() => setImgError(true)}
          priority={size === "xl"}
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-serif font-bold text-white"
          style={{ backgroundColor: philosopher.color }}
        >
          {philosopher.initials}
        </div>
      )}
    </div>
  );
}
