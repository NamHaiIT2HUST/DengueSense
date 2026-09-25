import clsx from "clsx";

/** Khung chờ đúng hình dạng nội dung (docs/10 §13) — không dùng spinner toàn trang. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx("animate-pulse rounded-md bg-[var(--bg-surface-2)]", className)}
    />
  );
}
