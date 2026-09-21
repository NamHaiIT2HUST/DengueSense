import { motion } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";

const PHASES = [
  {
    phase: "Phase 0",
    title: "Solo Bootstrap",
    period: "T9/2026",
    status: "done" as const,
    desc: "Kiến trúc, API contract, CI",
  },
  {
    phase: "Phase 1",
    title: "Dữ liệu",
    period: "T9–T10/2026",
    status: "active" as const,
    desc: "Crosswalk 34 tỉnh, OpenDengue, small-area estimation",
  },
  {
    phase: "Phase 2",
    title: "Mô hình dự báo",
    period: "T11–T12/2026",
    status: "todo" as const,
    desc: "4 model Tier 1, tuning, ensemble",
  },
  {
    phase: "Phase 3",
    title: "Tối ưu nguồn lực",
    period: "T12/2026",
    status: "todo" as const,
    desc: "MILP, đánh giá dưới bất định",
  },
  {
    phase: "Phase 4",
    title: "GenAI RAG",
    period: "T1/2027",
    status: "todo" as const,
    desc: "Guardrail, bộ vàng đánh giá",
  },
  {
    phase: "Phase 5–6",
    title: "Pilot thực địa",
    period: "Q2/2027",
    status: "todo" as const,
    desc: "1–2 bệnh viện/CDC, case study",
  },
];

const ICON = { done: Check, active: Loader2, todo: Circle };

export function RoadmapStrip() {
  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-[19px] h-px bg-[var(--border-hairline)] lg:left-6 lg:right-6" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
        {PHASES.map((p, i) => {
          const Icon = ICON[p.status];
          return (
            <motion.div
              key={p.phase}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="relative"
            >
              <div
                className="relative z-10 mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2"
                style={{
                  borderColor:
                    p.status === "todo" ? "var(--border-strong)" : "var(--accent)",
                  background: p.status === "todo" ? "var(--bg-surface)" : "var(--accent)",
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={2.5}
                  className={
                    p.status === "active"
                      ? "animate-spin text-white"
                      : p.status === "done"
                        ? "text-white"
                        : "text-[var(--ink-muted)]"
                  }
                />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                {p.phase}
              </div>
              <h4 className="font-display mt-0.5 text-[15px] font-semibold">
                {p.title}
              </h4>
              <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                {p.period}
              </div>
              <p className="mt-2 text-[13px] leading-snug text-[var(--ink-secondary)]">
                {p.desc}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
