import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-hairline)] px-6 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)]">
            <Activity size={15} strokeWidth={2.5} className="text-white" />
          </span>
          <span className="font-display text-sm font-semibold">DengueSense</span>
          <span className="text-[13px] text-[var(--ink-muted)]">· Đội thi MedSentinel</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-[var(--ink-muted)]">
          <a
            href="https://github.com/NamHaiIT2HUST/DengueSense"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[var(--ink-primary)]"
          >
            Mã nguồn
          </a>
          <a
            href="https://github.com/NamHaiIT2HUST/DengueSense/blob/main/README.md"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[var(--ink-primary)]"
          >
            Tài liệu kỹ thuật
          </a>
          <a
            href="https://github.com/NamHaiIT2HUST/DengueSense/blob/main/ROADMAP.md"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[var(--ink-primary)]"
          >
            Roadmap
          </a>
        </div>

        <p className="text-[12px] text-[var(--ink-muted)]">Cuộc thi Sáng tạo Trẻ 2026</p>
      </div>
    </footer>
  );
}
