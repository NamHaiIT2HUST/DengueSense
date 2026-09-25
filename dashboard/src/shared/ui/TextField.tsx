import clsx from "clsx";
import { useId, type InputHTMLAttributes, type Ref } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Thông báo lỗi của trường (đọc được bởi trình đọc màn hình qua aria-describedby). */
  error?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

/** Ô nhập có nhãn gắn với input (WCAG 1.3.1/3.3.1) và lỗi gắn qua aria-describedby. */
export function TextField({ label, error, className, id, ref, ...rest }: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const errorId = `${inputId}-error`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-[var(--ink-secondary)]">
        {label}
      </label>
      <input
        {...rest}
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={clsx(
          "w-full rounded-lg border bg-[var(--bg-surface-2)] px-3 py-2 text-[var(--ink-primary)] outline-none",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]",
          error ? "border-[var(--status-critical)]" : "border-[var(--border-strong)]",
          className
        )}
      />
      {error ? (
        <p id={errorId} className="text-sm text-[#f28b82]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
