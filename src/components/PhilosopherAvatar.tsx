"use client";

import { useState } from "react";
import Image from "next/image";

export function PhilosopherAvatar({
  philosopherId,
  name,
  color,
  initials,
  size = "md",
}: {
  philosopherId: string;
  name: string;
  color: string;
  initials: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [imgError, setImgError] = useState(false);

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
        boxShadow: `0 0 0 ${ring}px ${color}50`,
      }}
      title={name}
    >
      {!imgError ? (
        <Image
          src={avatarSrc}
          alt={name}
          width={px}
          height={px}
          className="rounded-full object-cover"
          onError={() => setImgError(true)}
          priority={size === "xl"}
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-serif font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
