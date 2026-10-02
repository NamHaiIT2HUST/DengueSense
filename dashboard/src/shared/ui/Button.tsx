import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Đang xử lý: khoá nút (tránh gửi hai lần) và báo cho trình đọc màn hình. */
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--accent-solid)] text-white hover:brightness-110",
  secondary:
    "border border-[var(--border-strong)] text-[var(--ink-primary)] hover:bg-[var(--bg-surface-hover)]",
  ghost:
    "text-[var(--ink-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--ink-primary)]",
};

export function Button({
  variant = "primary",
  loading = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </button>
  );
}
