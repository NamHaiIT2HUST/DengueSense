import clsx from "clsx";
import type { ReactNode } from "react";

type Tone = "error" | "info" | "warning";

const TONES: Record<Tone, string> = {
  error:
    "border-rose-300 bg-rose-50/90 text-rose-900 dark:border-[var(--status-critical)] dark:bg-[color-mix(in_srgb,var(--status-critical)_14%,transparent)] dark:text-[#f5b5b0]",
  warning:
    "border-amber-300 bg-amber-50/90 text-amber-950 dark:border-[var(--status-warning)] dark:bg-[color-mix(in_srgb,var(--status-warning)_12%,transparent)] dark:text-[#fbd98a]",
  info: "border-blue-200 bg-blue-50/90 text-blue-900 dark:border-[var(--accent)] dark:bg-[var(--accent-soft)] dark:text-[var(--accent-ink)]",
};

/** Lỗi dùng role="alert" (đọc ngay); thông tin/cảnh báo dùng role="status". */
export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={clsx("rounded-lg border px-4 py-3 text-sm", TONES[tone], className)}
    >
      {children}
    </div>
  );
}
