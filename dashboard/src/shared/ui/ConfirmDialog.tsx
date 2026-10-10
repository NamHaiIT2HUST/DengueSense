import { useEffect, useRef, type ReactNode } from "react";
import clsx from "clsx";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "primary" | "danger";
  loading?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Xác nhận",
  cancelText = "Huỷ bỏ",
  variant = "primary",
  loading = false,
  disabled = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <h3
          id="confirm-dialog-title"
          className="font-display text-lg font-semibold text-[var(--ink-primary)]"
        >
          {title}
        </h3>
        {description ? (
          <div className="mt-2 text-sm text-[var(--ink-secondary)]">{description}</div>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "primary" : "primary"}
            className={clsx(
              variant === "danger" && "bg-[var(--status-critical)]! hover:brightness-110!"
            )}
            onClick={onConfirm}
            loading={loading}
            disabled={disabled || loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
