import { Eyebrow } from "@/shared/ui/Badge";

export function SectionHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center px-2">
      <div className="flex justify-center">
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
      <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">{title}</h2>
      {desc && (
        <p className="mt-3 text-xs sm:text-sm lg:text-[15px] leading-relaxed text-[var(--ink-secondary)]">{desc}</p>
      )}
    </div>
  );
}
