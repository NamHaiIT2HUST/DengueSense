import clsx from "clsx";
import { useId } from "react";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

/**
 * Lựa chọn một trong vài phương án (nút phân đoạn). Dùng radio thật trong `fieldset` nên bàn phím (phím mũi tên) và
 * trình đọc màn hình hoạt động sẵn — không tự dựng ARIA.
 */
export function Segmented<T extends string | number>({
  legend,
  value,
  options,
  onChange,
  className,
}: {
  legend: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={clsx("min-w-0", className)}>
      <legend className="mb-1 text-xs text-[var(--ink-muted)]">{legend}</legend>
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-[var(--border-strong)] p-0.5">
        {options.map((o) => (
          <label key={String(o.value)} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={String(o.value)}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span
              className={clsx(
                "block rounded-full px-3 py-1 text-sm text-[var(--ink-secondary)] transition",
                "hover:text-[var(--ink-primary)]",
                "peer-checked:bg-[var(--accent-solid)] peer-checked:text-white",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]"
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
