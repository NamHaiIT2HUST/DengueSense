import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("glass-panel rounded-2xl p-5", className)}>{children}</section>;
}
