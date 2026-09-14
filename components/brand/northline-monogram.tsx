const N_PATH = "M12.5 24 V14 a3.5 3.5 0 0 1 7 0 V24";

export type NorthlineMonogramVariant = "brand" | "mono";

export function NorthlineMonogram({
  size = 32,
  variant = "brand",
  decorative = true,
  label,
  className,
}: {
  size?: number;
  variant?: NorthlineMonogramVariant;
  decorative?: boolean;
  label?: string;
  className?: string;
}) {
  const ink =
    variant === "brand"
      ? "var(--brand-mark-ink, var(--text-on-accent, #ffffff))"
      : "currentColor";
  return (
    <svg
      className={`northline-monogram northline-monogram--${variant}${
        className ? ` ${className}` : ""
      }`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      focusable="false"
    >
      {variant === "brand" && (
        <rect
          width="32"
          height="32"
          rx="8"
          fill="var(--brand-mark-bg, var(--color-accent, #c23b2e))"
        />
      )}
      <path
        d={N_PATH}
        stroke={ink}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
