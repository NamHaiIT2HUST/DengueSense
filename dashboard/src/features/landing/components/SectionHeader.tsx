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
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <div className="flex justify-center">
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
      <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {desc && (
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-secondary)]">{desc}</p>
      )}
    </div>
  );
}
