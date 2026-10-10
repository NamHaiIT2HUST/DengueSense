import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Activity, ArrowRight, ArrowLeft, Shield, Sparkles } from "lucide-react";

import { toUserFacing } from "@/shared/api";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";
import { env } from "@/shared/config/env";
import { vi } from "@/shared/i18n/vi";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { TextField } from "@/shared/ui/TextField";

import { login } from "./api";
import { safeRedirect } from "./safeRedirect";

const schema = z.object({
  username: z.string().trim().min(1, vi.auth.required).max(128, vi.auth.tooLong),
  password: z.string().min(1, vi.auth.required).max(256, vi.auth.tooLong),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage({ redirect }: { redirect?: string | undefined }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setFormError(null);
    try {
      await login(username, password);
    } catch (err) {
      // Sai tên/mật khẩu và tài khoản khoá đều là lỗi CHUNG của form (không gắn vào một trường để không gợi ý trường nào sai).
      setFormError(toUserFacing(err).message);
      return;
    }
    router.history.push(safeRedirect(redirect));
  });

  const isDemo = env.VITE_APP_MODE === "demo";

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 h-72 w-72 rounded-full bg-indigo-600/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand Icon & Heading */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/25">
            <Activity className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
            <Sparkles className="h-3 w-3" />
            <span>DengueSense Decision Platform</span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white">
            {vi.auth.title}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--ink-secondary)]">{vi.auth.subtitle}</p>
        </div>

        <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8">
          {isDemo ? (
            <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                <Shield className="h-3.5 w-3.5" />
                <span>{vi.auth.demoAccounts}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">{vi.auth.demoBanner}</p>
              <div className="mt-3 space-y-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <div
                    key={a.username}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-[var(--bg-surface)] px-3 py-2 text-xs"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-[var(--ink-primary)]">{a.displayName}</span>
                      <span className="text-[11px] text-[var(--ink-muted)]">
                        <code>{a.username}</code> / <code>{a.password}</code>
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      className="px-2.5 py-1 text-[11px] font-medium"
                      onClick={() => {
                        setValue("username", a.username);
                        setValue("password", a.password);
                      }}
                    >
                      {vi.auth.fillDemo}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={vi.auth.title}>
            {formError ? <Alert tone="error">{formError}</Alert> : null}
            <TextField
              label={vi.auth.username}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              error={errors.username?.message}
              {...register("username")}
            />
            <TextField
              label={vi.auth.password}
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span>{isSubmitting ? vi.auth.submitting : vi.auth.submit}</span>
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] transition-colors hover:text-[var(--ink-primary)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{vi.auth.backToLanding}</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
