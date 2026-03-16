import type { SVGProps } from "react";

type LogoNavProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export function LogoNav({ title = "Philagora", ...props }: LogoNavProps) {
  const labelledProps = title
    ? { role: "img" as const, "aria-label": title }
    : { "aria-hidden": true };

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 44" fill="none" {...labelledProps} {...props}>
      <g transform="translate(18 22)">
        <g opacity="0.6">
          <path d="M-8 14Q-15 6-14-4Q-12-10-8-16" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <ellipse cx="-12" cy="8" rx="2.5" ry="5" fill="currentColor" transform="rotate(-20 -12 8)" opacity="0.5" />
          <ellipse cx="-14" cy="-2" rx="2.5" ry="5" fill="currentColor" transform="rotate(-5 -14 -2)" opacity="0.5" />
          <ellipse cx="-11" cy="-11" rx="2" ry="4.5" fill="currentColor" transform="rotate(15 -11 -11)" opacity="0.5" />
          <path d="M8 14Q15 6 14-4Q12-10 8-16" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <ellipse cx="12" cy="8" rx="2.5" ry="5" fill="currentColor" transform="rotate(20 12 8)" opacity="0.5" />
          <ellipse cx="14" cy="-2" rx="2.5" ry="5" fill="currentColor" transform="rotate(5 14 -2)" opacity="0.5" />
          <ellipse cx="11" cy="-11" rx="2" ry="4.5" fill="currentColor" transform="rotate(-15 11 -11)" opacity="0.5" />
        </g>
        <circle cx="0" cy="0" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="0" y1="-16" x2="0" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="-2.5" y1="-16" x2="2.5" y2="-16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="-2.5" y1="16" x2="2.5" y2="16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="24" y1="-12" x2="24" y2="12" stroke="currentColor" strokeWidth="0.5" opacity="0.25" />
        <text
          x="32"
          y="6"
          fill="currentColor"
          fontFamily="'Playfair Display', Georgia, serif"
          fontSize="18"
          letterSpacing="1.5"
        >
          Philagora
        </text>
      </g>
    </svg>
  );
}
