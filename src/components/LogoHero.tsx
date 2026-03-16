import type { SVGProps } from "react";

type LogoHeroProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export function LogoHero({ title = "Philagora", ...props }: LogoHeroProps) {
  const labelledProps = title
    ? { role: "img" as const, "aria-label": title }
    : { "aria-hidden": true };

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 360" fill="none" {...labelledProps} {...props}>
      <g transform="translate(200 150)">
        <g opacity="0.8">
          <path
            d="M-30 62Q-52 30-50-5Q-48-30-36-55Q-30-66-22-72"
            fill="none"
            stroke="#3C4A3A"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path d="M-34 56Q-48 48-54 34Q-46 40-38 50Z" fill="#3C4A3A" opacity="0.6" />
          <path d="M-38 46Q-28 38-26 26Q-32 34-40 42Z" fill="#3C4A3A" opacity="0.55" />
          <path d="M-44 32Q-60 22-62 8Q-54 16-46 28Z" fill="#3C4A3A" opacity="0.65" />
          <path d="M-48 22Q-36 12-32-2Q-38 8-48 18Z" fill="#3C4A3A" opacity="0.55" />
          <path d="M-50 8Q-66-4-66-20Q-58-10-50 2Z" fill="#3C4A3A" opacity="0.7" />
          <path d="M-50-4Q-38-16-34-30Q-40-18-50-8Z" fill="#3C4A3A" opacity="0.55" />
          <path d="M-48-18Q-62-32-58-46Q-54-36-46-22Z" fill="#3C4A3A" opacity="0.65" />
          <path d="M-44-30Q-34-42-28-54Q-34-44-44-34Z" fill="#3C4A3A" opacity="0.55" />
          <path d="M-38-48Q-50-60-44-72Q-42-62-36-52Z" fill="#3C4A3A" opacity="0.6" />
          <path d="M-32-58Q-22-68-16-78Q-22-70-32-62Z" fill="#3C4A3A" opacity="0.5" />
        </g>
        <g opacity="0.8">
          <path
            d="M30 62Q52 30 50-5Q48-30 36-55Q30-66 22-72"
            fill="none"
            stroke="#3C4A3A"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path d="M34 56Q48 48 54 34Q46 40 38 50Z" fill="#3C4A3A" opacity="0.6" />
          <path d="M38 46Q28 38 26 26Q32 34 40 42Z" fill="#3C4A3A" opacity="0.55" />
          <path d="M44 32Q60 22 62 8Q54 16 46 28Z" fill="#3C4A3A" opacity="0.65" />
          <path d="M48 22Q36 12 32-2Q38 8 48 18Z" fill="#3C4A3A" opacity="0.55" />
          <path d="M50 8Q66-4 66-20Q58-10 50 2Z" fill="#3C4A3A" opacity="0.7" />
          <path d="M50-4Q38-16 34-30Q40-18 50-8Z" fill="#3C4A3A" opacity="0.55" />
          <path d="M48-18Q62-32 58-46Q54-36 46-22Z" fill="#3C4A3A" opacity="0.65" />
          <path d="M44-30Q34-42 28-54Q34-44 44-34Z" fill="#3C4A3A" opacity="0.55" />
          <path d="M38-48Q50-60 44-72Q42-62 36-52Z" fill="#3C4A3A" opacity="0.6" />
          <path d="M32-58Q22-68 16-78Q22-70 32-62Z" fill="#3C4A3A" opacity="0.5" />
        </g>
        <line x1="0" y1="-66" x2="0" y2="66" stroke="#3C4A3A" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="36" fill="none" stroke="#3C4A3A" strokeWidth="3.2" />
        <line x1="-6" y1="-66" x2="6" y2="-66" stroke="#3C4A3A" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="-6" y1="66" x2="6" y2="66" stroke="#3C4A3A" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <text
        x="200"
        y="296"
        fill="#3C4A3A"
        fontFamily="'Playfair Display', Georgia, serif"
        fontSize="34"
        fontWeight="400"
        letterSpacing="4"
        textAnchor="middle"
      >
        Philagora
      </text>
      <line x1="116" y1="310" x2="284" y2="310" stroke="#3C4A3A" strokeWidth="0.5" opacity="0.3" />
      <text
        x="200"
        y="330"
        fill="#3C4A3A"
        fontFamily="'DM Sans', -apple-system, sans-serif"
        fontSize="11"
        fontWeight="400"
        letterSpacing="4.5"
        opacity="0.5"
        textAnchor="middle"
      >
        THE PHILOSOPHERS ARE ONLINE
      </text>
    </svg>
  );
}
