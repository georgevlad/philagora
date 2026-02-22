import { philosophers } from "@/data/philosophers";

export function PhilosopherAvatar({
  philosopherId,
  size = "md",
}: {
  philosopherId: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const philosopher = philosophers[philosopherId];
  if (!philosopher) return null;

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-lg",
    xl: "w-20 h-20 text-2xl",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-serif font-bold text-white shrink-0 transition-transform duration-200 hover:scale-105`}
      style={{ backgroundColor: philosopher.color }}
      title={philosopher.name}
    >
      {philosopher.initials}
    </div>
  );
}
