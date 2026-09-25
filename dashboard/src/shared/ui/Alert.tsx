import clsx from "clsx";
import type { ReactNode } from "react";

type Tone = "error" | "info" | "warning";

const TONES: Record<Tone, string> = {
  error:
    "border-[var(--status-critical)] bg-[color-mix(in_srgb,var(--status-critical)_14%,transparent)] text-[#f5b5b0]",
  warning:
    "border-[var(--status-warning)] bg-[color-mix(in_srgb,var(--status-warning)_12%,transparent)] text-[#fbd98a]",
  info: "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]",
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
