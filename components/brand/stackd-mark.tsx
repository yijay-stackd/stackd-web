type Props = {
  size?: number;
  title?: string;
  className?: string;
};

export function StackdMark({ size = 26, title = "stackd", className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label={title}
    >
      <rect width="24" height="24" rx="6" fill="#0a0a0a" />
      <rect x="5" y="5" width="14" height="3.8" rx="1.3" fill="var(--color-accent, #d6ff3d)" />
      <rect x="5" y="10.1" width="9.5" height="3.8" rx="1.3" fill="var(--color-accent, #d6ff3d)" />
      <rect x="5" y="15.2" width="14" height="3.8" rx="1.3" fill="var(--color-accent, #d6ff3d)" />
    </svg>
  );
}
