import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
  elevated = false,
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <section
      className={clsx(
        elevated ? "glass-panel-elevated" : "glass-panel",
        "rounded-2xl p-6 transition-all duration-200",
        className
      )}
    >
      {children}
    </section>
  );
}
