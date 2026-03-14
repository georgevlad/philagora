interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
  stroke?: string;
}

export function ChevronLeftIcon({
  size = 16,
  className,
  strokeWidth = 1.5,
  stroke = "currentColor",
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
    >
      <path d="M10 4L6 8L10 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BookIcon({
  size = 16,
  className,
  strokeWidth = 1.5,
  stroke = "currentColor",
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
    >
      <path d="M3 12L3 4C3 2.89543 3.89543 2 5 2H11C12.1046 2 13 2.89543 13 4V12C13 13.1046 12.1046 14 11 14H5C3.89543 14 3 13.1046 3 12Z" />
      <path d="M6 6H10" strokeLinecap="round" />
      <path d="M6 9H8" strokeLinecap="round" />
    </svg>
  );
}

export function ReplyArrowIcon({
  size = 12,
  className,
  strokeWidth = 1.5,
  stroke = "currentColor",
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
    >
      <path d="M6 3L3 6L6 9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6H10C12.2091 6 14 7.79086 14 10V13" strokeLinecap="round" />
    </svg>
  );
}

export function ExternalLinkIcon({
  size = 15,
  className,
  strokeWidth = 1.5,
  stroke = "currentColor",
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
    >
      <path d="M6 3H3V13H13V10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 2H14V7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2L7 9" strokeLinecap="round" />
    </svg>
  );
}

export function ReplyIcon({
  size = 16,
  className,
  strokeWidth = 1.5,
  stroke = "currentColor",
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
    >
      <path d="M14 10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6L2 15V4C2 3.46957 2.21071 2.96086 2.58579 2.58579C2.96086 2.21071 3.46957 2 4 2H12C12.5304 2 13.0391 2.21071 13.4142 2.58579C13.7893 2.96086 14 3.46957 14 4V10Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HeartIcon({
  size = 16,
  className,
  strokeWidth = 1.5,
  stroke = "currentColor",
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
    >
      <path d="M8 14L1.5 7.5C0.5 6.5 0.5 4.5 1.5 3.5C2.5 2.5 4.5 2.5 5.5 3.5L8 6L10.5 3.5C11.5 2.5 13.5 2.5 14.5 3.5C15.5 4.5 15.5 6.5 14.5 7.5L8 14Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BookmarkIcon({
  size = 16,
  className,
  strokeWidth = 1.5,
  stroke = "currentColor",
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
    >
      <path d="M3 2H13V14L8 11L3 14V2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeIcon({
  size = 20,
  className,
  strokeWidth = 1.5,
  stroke = "currentColor",
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
    >
      <path d="M3 10L10 3L17 10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8.5V16H8V12H12V16H15V8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DebatesIcon({
  size = 20,
  className,
  strokeWidth = 1.5,
  stroke = "currentColor",
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
    >
      <path d="M4 4H12V11H7L4 14V4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11H16V18L13 15H8V11Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AgoraIcon({
  size = 20,
  className,
  strokeWidth = 1.5,
  stroke = "currentColor",
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M10 7V10.5" strokeLinecap="round" />
      <circle cx="10" cy="13" r="0.5" fill="currentColor" />
    </svg>
  );
}
