import clsx from "clsx";
import { useId, type SelectHTMLAttributes } from "react";

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** Hộp chọn có nhãn gắn với điều khiển (label ↔ select), theo phong cách của `TextField`. */
export function Select({ label, options, onChange, className, ...rest }: Props) {
  const id = useId();
  return (
    <div className={clsx("min-w-0", className)}>
      <label htmlFor={id} className="mb-1 block text-xs text-[var(--ink-muted)]">
        {label}
      </label>
      <select
        id={id}
        {...rest}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--ink-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
